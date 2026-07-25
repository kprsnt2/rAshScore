import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const revalidate = 3600;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = await getDb();
    
    // Create table if not exists (in case it's not yet created by pipeline)
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL,
        published_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const result = db.exec(`
      SELECT slug, title, content_md, published_at 
      FROM reports 
      WHERE slug = '${slug.replace(/'/g, "''")}'
    `);
    
    if (result.length === 0 || result[0].values.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const row = result[0].values[0];
    const report = {
      slug: row[0],
      title: row[1],
      content_md: row[2],
      published_at: row[3],
    };

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
