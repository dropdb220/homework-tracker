import { MongoClient } from "mongodb";
import fetch from "node-fetch";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const code = (await request.json()).code;
    if (!code) {
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 접속입니다.' }), { status: 400 });
    }
    const siteToken = request.headers.get('Authorization');
    if (!siteToken) {
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenToUser = await tokenCollection.findOne({ token: siteToken });
    if (!tokenToUser) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인 상태가 아닙니다.' }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const loginedUser = await usersCollection.findOne({ id: tokenToUser.id });
    if (loginedUser!.discordConnected) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '이미 연동된 계정이 있습니다.' }), { status: 400 });
    }

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
            client_secret: process.env.DISCORD_CLIENT_SECRET!,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI!
        }).toString()
    });
    if (!tokenResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: 'Discord 연동에 실패했습니다. (토큰 받기 실패)' }), { status: 500 });
    }
    const token: any = await tokenResponse.json();
    const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `${token.token_type} ${token.access_token}`
        }
    });
    if (!userResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: 'Discord 연동에 실패했습니다. (유저 정보 받기 실패)' }), { status: 500 });
    }
    const user: any = await userResponse.json();
    const guildResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: {
            Authorization: `${token.token_type} ${token.access_token}`
        }
    });
    if (!guildResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: 'Discord 연동에 실패했습니다. (서버 정보 받기 실패)' }), { status: 500 });
    }
    const guilds: any = await guildResponse.json();
    const guild = guilds.find((guild: any) => guild.id === process.env.DISCORD_GUILD_ID);
    if (!guild) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: 'Discord 서버에 먼저 가입하세요.' }), { status: 403 });
    }
    const assignRoleResponse = await fetch(`http://localhost:${process.env.DISCORD_BOT_SERVER_PORT}/authuser`, {
        method: 'POST',
        headers: {
            'authorization': process.env.DISCORD_BOT_SERVER_AUTH!,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ id: user.id }).toString()
    });
    if (!assignRoleResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: 'Discord 연동에 실패했습니다. (역할 지정 실패)' }), { status: 500 });
    }
    await usersCollection.updateOne({ id: loginedUser!.id }, { $set: { discordConnected: true, discordID: user.id } });
    client.close();
    return new Response(JSON.stringify({ code: 0, data: { id: user.id } }), { status: 200 });
}

export async function DELETE(request: Request) {
    const siteToken = request.headers.get('Authorization');
    if (!siteToken) {
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenToUser = await tokenCollection.findOne({ token: siteToken });
    if (!tokenToUser) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인 상태가 아닙니다.' }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const loginedUser = await usersCollection.findOne({ id: tokenToUser.id });
    if (!loginedUser!.discordConnected) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '연동된 계정이 없습니다.' }), { status: 400 });
    }

    const removeRoleResponse = await fetch(`http://localhost:${process.env.DISCORD_BOT_SERVER_PORT}/deauthuser`, {
        method: 'POST',
        headers: {
            'authorization': process.env.DISCORD_BOT_SERVER_AUTH!,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ id: loginedUser!.discordID }).toString()
    });
    if (!removeRoleResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: 'Discord 연동 해제에 실패했습니다. (역할 해제 실패)' }), { status: 500 });
    }
    await usersCollection.updateOne({ id: loginedUser!.id }, { $set: { discordConnected: false, discordID: null } });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}