import { NextResponse } from 'next/server';
import { databases } from '@/lib/appwrite';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Query the admin collection for matching password
    const response = await databases.listDocuments(
      process.env.NEXT_PUBLIC_DATABASE_ID!,
      'admin',
      [
        `password=${password}`
      ]
    );

    if (response.documents.length === 0) {
      return NextResponse.json(
        { isAdmin: false },
        { status: 200 }
      );
    }

    const admin = response.documents[0];
    return NextResponse.json({
      isAdmin: true,
      name: admin.name
    });

  } catch (error) {
    console.error('Error verifying admin:', error);
    return NextResponse.json(
      { error: 'Failed to verify admin credentials' },
      { status: 500 }
    );
  }
} 