import type { NextApiRequest, NextApiResponse } from 'next';
import { getExpressApp } from '@sfaizh/api';

/**
 * The whole NestJS application, mounted inside Next.js.
 *
 * The Pages Router is used deliberately: its handlers receive the real Node
 * `IncomingMessage`/`ServerResponse` pair that Express expects, whereas an App
 * Router route handler would hand over a Web `Request` that would need
 * shimming. Body parsing is disabled so Nest's own parsers — including the raw
 * parser the image upload route depends on — see an untouched stream.
 */
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
    responseLimit: '8mb',
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const server = await getExpressApp();
  server(req, res);
}
