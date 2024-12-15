import fs from 'node:fs/promises';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    props: { params: Promise<{ fileName: string, dlName: string }> }
) {
    const params = await props.params;
    if (!(await fs.readdir('./upload/unlock')).includes(params.fileName)) {
        return new Response("Not Found", { status: 404 });
    }
    return new Response(await fs.readFile(`./upload/unlock/${params.fileName}`), { status: 200, headers: { 'Content-Type': 'application/octet-stream' /* for iOS Safari */ } });
}
