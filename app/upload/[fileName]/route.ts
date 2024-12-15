import fs from 'node:fs/promises';
import { lookup } from 'mime-types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ fileName: string }> }) {
    const { fileName } = await params;
    if (!(await fs.readdir('./upload')).includes(fileName)) {
        return new Response("Not Found", { status: 404 });
    }
    return new Response(await fs.readFile(`./upload/${fileName}`), { status: 200, headers: { 'Content-Type': lookup(fileName) + '; charset=UTF-8' || 'application/octet-stream' } });
}
