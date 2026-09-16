import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllCategories,
    getAllPublishers,
    getFilteredGames,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns filter options ordered by name', async () => {
        await db.insert(categories).values([
            { name: 'Puzzle', description: 'puzzle' },
            { name: 'Strategy', description: 'strategy' },
        ]);
        await db.insert(publishers).values([
            { name: 'Zeta Games', description: 'zeta' },
            { name: 'Alpha Games', description: 'alpha' },
        ]);

        expect((await getAllCategories(db)).map((category) => category.name)).toEqual([
            'Puzzle',
            'Strategy',
        ]);
        expect((await getAllPublishers(db)).map((publisher) => publisher.name)).toEqual([
            'Alpha Games',
            'Zeta Games',
        ]);
    });

    it('filters games by one or more categories', async () => {
        const [strategy] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'strategy' })
            .returning({ id: categories.id });
        const [puzzle] = await db
            .insert(categories)
            .values({ name: 'Puzzle', description: 'puzzle' })
            .returning({ id: categories.id });
        const [publisher] = await db
            .insert(publishers)
            .values({ name: 'Publisher', description: 'publisher' })
            .returning({ id: publishers.id });
        await db.insert(games).values([
            {
                title: 'Puzzle Game',
                description: 'puzzle',
                categoryId: puzzle.id,
                publisherId: publisher.id,
            },
            {
                title: 'Strategy Game',
                description: 'strategy',
                categoryId: strategy.id,
                publisherId: publisher.id,
            },
        ]);

        const filtered = await getFilteredGames(db, {
            categoryIds: [strategy.id, puzzle.id],
        });
        expect(filtered.map((game) => game.title)).toEqual(['Puzzle Game', 'Strategy Game']);
    });

    it('combines category and publisher filters', async () => {
        const [category] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'strategy' })
            .returning({ id: categories.id });
        const [firstPublisher] = await db
            .insert(publishers)
            .values({ name: 'First Publisher', description: 'first' })
            .returning({ id: publishers.id });
        const [secondPublisher] = await db
            .insert(publishers)
            .values({ name: 'Second Publisher', description: 'second' })
            .returning({ id: publishers.id });
        await db.insert(games).values([
            {
                title: 'First Game',
                description: 'first',
                categoryId: category.id,
                publisherId: firstPublisher.id,
            },
            {
                title: 'Second Game',
                description: 'second',
                categoryId: category.id,
                publisherId: secondPublisher.id,
            },
        ]);

        const filtered = await getFilteredGames(db, {
            categoryIds: [category.id],
            publisherId: secondPublisher.id,
        });
        expect(filtered.map((game) => game.title)).toEqual(['Second Game']);
    });

    it('returns no games when filters do not match', async () => {
        await seedGames(db, 1);
        expect(await getFilteredGames(db, { publisherId: 99999 })).toEqual([]);
    });
});
