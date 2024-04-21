import { MongoClient } from "mongodb";
import { sendNotification, setVapidDetails } from "web-push";
import { postType } from "@/app/types";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokensCollection = db.collection('tokens');
    const token = request.headers.get('Authorization');
    if (!token) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }
    const tokenData = await tokensCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 토큰입니다.' }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: tokenData.id });
    if (!userData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 사용자입니다.' }), { status: 401 });
    }
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '승인 대기 중입니다.' }), { status: 403 });
    }
    const postsCollection = db.collection('posts');
    let posts = await postsCollection.find().toArray();
    await Promise.all(posts.filter(post => post.deadline && (new Date(post.deadline) as unknown as number <= (new Date() as unknown as number) - 1000 * 60 * 60 * 24)).map(async post => {
        return postsCollection.deleteOne({ count: post.count });
    }));
    client.close();
    posts = posts.filter(post => !post.deadline || (new Date(post.deadline) as unknown as number > (new Date() as unknown as number) - 1000 * 60 * 60 * 24));
    const sortedPosts = posts.filter(post => post.type === 0).filter(post => post.deadline != null).sort((a, b) => (new Date(a.deadline) as unknown as number) - (new Date(b.deadline) as unknown as number))
        .concat(posts.filter(post => post.type === 0).filter(post => post.deadline == null).reverse())
        .concat(posts.filter(post => post.type > 0).filter(post => post.deadline != null).sort((a, b) => a.deadline === b.deadline ? a.type - b.type : (new Date(a.deadline) as unknown as number) - (new Date(b.deadline) as unknown as number)))
        .concat(posts.filter(post => post.type > 0).filter(post => post.deadline == null).sort((a, b) => a.type - b.type));
    return new Response(JSON.stringify(sortedPosts.map(x => { return { count: x.count, title: x.title, type: x.type, deadline: x.deadline }; })), { status: 200 });
}

export async function POST(request: Request) {
    const token = request.headers.get('Authorization');
    if (!token) {
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenData = await tokenCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: tokenData.id });
    if (!userData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 사용자입니다.' }), { status: 401 });
    }
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '승인 대기 중입니다.' }), { status: 403 });
    }
    const data = await request.json();
    if (!data.title || data.type == null || !data.content) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '제목, 타입, 내용을 입력하세요.' }), { status: 400 });
    }
    if (typeof data.title !== 'string' || typeof data.type !== 'number' || typeof data.content !== 'string' || (data.deadline && (typeof data.deadline !== 'string' || new Date(data.deadline).toString() === 'Invalid Date'))) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '제목, 내용은 문자열, 유형은 숫자, 마감 기한은 유효한 날짜여야 합니다.' }), { status: 400 });
    }
    if (data.type < 0 || data.type >= (postType as Array<string>).length - 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 유형입니다.' }), { status: 400 });
    }
    if (data.type === 0 && userData.perm > 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '중요 공지는 관리자만 등록할 수 있습니다.' }), { status: 403 });
    }
    const postsCollection = db.collection('posts');
    const count = (await postsCollection.find().toArray()).map(x => x.count).reduce((a: number, b: number) => Math.max(a, b), 0) + 1;
    await postsCollection.insertOne({ count, title: data.title, type: data.type, content: data.content, deadline: data.deadline ? new Date(data.deadline) : null, author: userData.id, created: new Date() });
    const userList = await usersCollection.find({ id: { $ne: userData.id } }).toArray();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    userList.forEach(user => {
        user.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([{
                title: `${postType[data.type]} 공지 등록됨`,
                body: `${data.title}이(가) 등록되었습니다.`,
                tag: count.toString()
            }])).catch(() => { })
        });
    });
    client.close();
    return new Response(JSON.stringify({ code: 0, count }), { status: 200 });
}