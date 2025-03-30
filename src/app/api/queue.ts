// pages/api/queue.ts

import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  queue?: string[];
  error?: string;
};

let queue: string[] = [];

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method === 'GET') {
    // Return the current queue as JSON
    res.status(200).json({ queue });
  } else if (req.method === 'POST') {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    // Add the submitted text to the queue
    queue.push(text);
    res.status(200).json({ queue });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
