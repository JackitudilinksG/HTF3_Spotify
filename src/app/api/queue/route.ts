import { NextResponse } from 'next/server';

// In-memory queue storage
let queue: any[] = [];

export async function GET() {
  return NextResponse.json({ queue });
}

export async function POST(request: Request) {
  try {
    const { track } = await request.json();
    
    if (!track) {
      return NextResponse.json(
        { error: 'No track provided' },
        { status: 400 }
      );
    }

    // Add the track to the queue
    queue.push(track);
    
    return NextResponse.json({ queue });
  } catch (error) {
    console.error('Error adding track:', error);
    return NextResponse.json(
      { error: 'Failed to add track' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { queue: newQueue } = await request.json();
    
    if (!Array.isArray(newQueue)) {
      return NextResponse.json(
        { error: 'Invalid queue format' },
        { status: 400 }
      );
    }

    // Update the queue
    queue = newQueue;
    
    return NextResponse.json({ queue });
  } catch (error) {
    console.error('Error updating queue:', error);
    return NextResponse.json(
      { error: 'Failed to update queue' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // Clear the queue
    queue = [];
    return NextResponse.json({ queue });
  } catch (error) {
    console.error('Error clearing queue:', error);
    return NextResponse.json(
      { error: 'Failed to clear queue' },
      { status: 500 }
    );
  }
} 