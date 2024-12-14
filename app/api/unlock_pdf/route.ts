import { MongoClient } from "mongodb";
import fs from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'mime-types';
import cp from 'node:child_process';
import { promisify } from "node:util";
const crypto = globalThis.crypto;
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokensCollection = db.collection('tokens');
    const token = request.headers.get('Authorization');
    if (!token) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.loginRequired[clientLang] }), { status: 401 });
    }
    const tokenData = await tokensCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentToken[clientLang] }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: tokenData.id });
    if (!userData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidUser[clientLang] }), { status: 401 });
    }
    clientLang = userData.lang;
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notApproved[clientLang] }), { status: 403 });
    }
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.noFile[clientLang] }), { status: 400 });
    }
    if (file.size > 1024 * 1024 * 2 * Number(process.env.NEXT_PUBLIC_UPLOAD_LIMIT_MIB)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: `${i18n.fileTooLargeA[clientLang]}${2 * Number(process.env.NEXT_PUBLIC_UPLOAD_LIMIT_MIB)}${i18n.fileTooLargeB[clientLang]}` }), { status: 400 });
    }
    if (!file.name || file.name === '') {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.noFileName[clientLang] }), { status: 400 });
    }
    const fileArrayBuffer = await file.arrayBuffer();
    const hash = Buffer.from(await crypto.subtle.digest('SHA-1', fileArrayBuffer)).toString('hex');
    if (lookup(file.name) !== 'application/pdf') {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.PDFOnly[clientLang] }), { status: 400 });
    }
    client.close();
    const fileDir = './upload/unlock';
    try {
        await fs.stat(fileDir);
    } catch {
        await fs.mkdir(fileDir);
    }
    const filePath = await fs.readdir(fileDir).then(files => files.find(fileName => fileName.includes(`${hash}-unlocked.pdf`)));
    if (filePath) {
        return new Response(JSON.stringify({ code: 0, path: `/${fileDir.split('/').reverse()[0]}/${filePath}`, dlName: file.name.replace(/.pdf$/, '-unlocked.pdf') }), { status: 200 });
    }
    await fs.writeFile(`${fileDir}/${hash}-locked.pdf`, Buffer.from(fileArrayBuffer));
    const exec = promisify(cp.exec);
    try {
        await exec(`qpdf --decrypt "${fileDir}/${hash}-locked.pdf" "${fileDir}/${hash}-unlocked.pdf"`);
        await fs.rm(`${fileDir}/${hash}-locked.pdf`);
        return new Response(JSON.stringify({ code: 0, path: `/${fileDir.split('/').reverse()[0]}/${hash}-unlocked.pdf`, dlName: file.name.replace(/.pdf$/, '-unlocked.pdf') }), { status: 200 });
    } catch {
        return new Response(JSON.stringify({ code: 1, msg: i18n.PDFUnlockFailed[clientLang] }), { status: 500 });
    }
}