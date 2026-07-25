import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const revalidate = 3600;

export async function GET() {
  try {
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
      SELECT slug, title, published_at, SUBSTR(content_md, 1, 200) as snippet 
      FROM reports 
      ORDER BY published_at DESC
    `);
    
    if (result.length === 0) {
      return NextResponse.json({ reports: [] });
    }

    const cols = result[0].columns;
    const reports = result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      // Clean snippet
      obj.snippet = obj.snippet.replace(/#/g, '').trim() + '...';
      return obj;
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
