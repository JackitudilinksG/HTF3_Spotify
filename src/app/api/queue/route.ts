import { NextResponse } from 'next/server';

// In-memory storage for the queue
let queue: any[] = [];

export async function GET() {
  return NextResponse.json({ queue });
}

export async function POST(request: Request) {
  const { track } = await request.json();
  
  if (!track) {
    return NextResponse.json({ error: 'No track provided' }, { status: 400 });
  }

  queue.push(track);
  return NextResponse.json({ queue });
}

export async function DELETE() {
  queue = [];
  return NextResponse.json({ queue });
} 