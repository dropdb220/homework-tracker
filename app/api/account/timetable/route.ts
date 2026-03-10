import { MongoClient, ObjectId } from "mongodb";
import _i18n from "@/app/i18n.json";
import { NextRequest } from "next/server";
const i18n: { [key: string]: string | string[] } = _i18n;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
    client.close();
    let userTimetable = process.env.NEXT_PUBLIC_TIMETABLE?.split(';').map(x => x.split(',').map(y => {
        if (y.charCodeAt(0) >= 65 && y.charCodeAt(0) <= 90) {
            const subject = userData.subjects[y] ?? process.env.NEXT_PUBLIC_DEFAULT_SUBJECTS?.split(';').find(subject => subject.startsWith(y + '='))?.split('=')[1];
            return {
                fixed: false,
                name: subject,
                time: y
            }
        } else {
            return {
                fixed: true,
                name: y
            }
        }
    })) || [];
    return new Response(JSON.stringify({
        code: 0,
        data: {
            timetable: userTimetable,
            all_subjects: process.env.NEXT_PUBLIC_SUBJECTS?.split(','),
            subjects: userData.subjects
        }
    }), { status: 200 });
}

export async function PUT(request: Request) {
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
    const body = await request.json();
    if (!body.changes || !Array.isArray(body.changes) || body.changes.some((change: any) => typeof change.time !== 'string' || change.time.charCodeAt(0) < 65 || change.time.charCodeAt(0) > 90 || typeof change.subject !== 'string' || !process.env.NEXT_PUBLIC_SUBJECTS?.split(',').includes(change.subject))) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.malformed[clientLang] }), { status: 400 });
    }
    const newSubjects = { ...userData.subjects };
    body.changes.forEach((change: any) => {
        newSubjects[change.time] = change.subject;
    });
    await usersCollection.updateOne({ id: tokenData.id }, { $set: { subjects: newSubjects } });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}
