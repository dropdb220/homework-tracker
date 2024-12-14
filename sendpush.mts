import { MongoClient } from "mongodb";
import webpush from "web-push";
const { sendNotification, setVapidDetails } = webpush;
import { postType, deadlineName, postTypeEn, deadlineNameEn } from "./app/types.js";
import dotenv from "dotenv";

const NODE_ENV = process.env.NODE_ENV || "development";

dotenv.config({ path: [`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, '.env'] });
setVapidDetails(`mailto:${process.env.VAPID_EMAIL}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);

const client = new MongoClient(process.env.MONGO!);
// @ts-ignore
await client.connect();
const db = client.db(process.env.DB_NAME);
const usersCollection = db.collection('users');
// @ts-ignore
const userList = await usersCollection.find().toArray();
const postsCollection = db.collection('posts');
// @ts-ignore
const allPosts = await postsCollection.find().toArray();
const twoDaysLeft = allPosts.filter(post => post.deadline && new Date(post.deadline) as unknown as number - Date.now() <= 2 * 24 * 60 * 60 * 1000 && new Date(post.deadline) as unknown as number - Date.now() > 24 * 60 * 60 * 1000);
const oneDayLeft = allPosts.filter(post => post.deadline && new Date(post.deadline) as unknown as number - Date.now() <= 24 * 60 * 60 * 1000 && new Date(post.deadline) as unknown as number - Date.now() > 0);
const examsCollection = db.collection('exams');
// @ts-ignore
const allExams = await examsCollection.find().toArray();
const closestExam = allExams.filter(exam => (new Date(exam.subjects.slice(-1)[0].date) as unknown as number) > Date.now()).sort((a, b) => (new Date(a.subjects[0].date) as unknown as number) - (new Date(b.subjects[0].date) as unknown as number))[0];
if (closestExam) {
    console.log(closestExam)
    const tomorrow = closestExam.subjects.find((subject: any) => (new Date(subject.date) as unknown as number) - Date.now() <= 24 * 60 * 60 * 1000 && (new Date(subject.date) as unknown as number) - Date.now() > 0);
    if (tomorrow && tomorrow.subjects.length > 0) {
        const data = {
            title: `시험 과목 안내`,
            body: `${new Date(tomorrow.date).toLocaleDateString('ko-KR', {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: 'Asia/Seoul'
            })}\n${tomorrow.subjects.map((subj: string, idx: number) => `${idx + 1}교시 ${subj[0]}`).join('\n')}`,
            tag: 'exam'
        };
        const dataEn = {
            title: `Exam Subject Notification`,
            body: `${new Date(tomorrow.date).toLocaleDateString('en_US', {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: 'Asia/Seoul'
            })}\n${tomorrow.subjects.map((subj: string, idx: number) => `Period ${idx + 1}: ${subj[1]}`).join('\n')}`,
            tag: 'exam'
        };
        userList.forEach(user => {
            user.subscriptions.forEach(async (sub: any) => {
                sendNotification(sub, JSON.stringify([user.lang === 1 ? dataEn : data])).catch(() => { })
            });
        });
    }
}
const csatCollection = db.collection('csat');
// @ts-ignore
const allCsats = await csatCollection.find().toArray();
const closestCsat = allCsats.filter(csat => (new Date(csat.date) as unknown as number) > Date.now() && (new Date(csat.date) as unknown as number) <= Date.now() + 24 * 60 * 60 * 1000).sort((a, b) => (new Date(a.date) as unknown as number) - (new Date(b.date) as unknown as number))[0];
if (closestCsat) {
    const data = {
        title: `수능/모평/학평 1일 전`,
        body: `${closestCsat.year}년 ${closestCsat.month}월 ${closestCsat.type} 1일 전입니다.`,
        tag: 'csat'
    };
    const dataEn = {
        title: `CSAT/Mock CSAT in 1 Day`,
        body: `${closestCsat.year}/${closestCsat.month} ${closestCsat.type_en} is tomorrow.`,
        tag: 'csat'
    };
    userList.forEach(user => {
        user.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([user.lang === 1 ? dataEn : data])).catch(() => { })
        });
    });
}
const data = twoDaysLeft.map(post => {
    return {
        title: `${postType[post.type]} ${deadlineName[post.type]} 2일 전`,
        body: `${post.title} ${deadlineName[post.type]} 2일 전입니다.`,
        tag: post.count.toString()
    }
}).concat(oneDayLeft.map(post => {
    return {
        title: `${postType[post.type]} ${deadlineName[post.type]} 1일 전`,
        body: `${post.title} ${deadlineName[post.type]} 1일 전입니다.`,
        tag: post.count.toString()
    }
}));
const dataEn = twoDaysLeft.map(post => {
    return {
        title: `${postTypeEn[post.type]} ${deadlineNameEn[post.type]} in 2 Days`,
        body: `${post.title_en === "" ? post.title : post.title_en} ${deadlineNameEn[post.type]} is in 2 days.`,
        tag: post.count.toString()
    }
}).concat(oneDayLeft.map(post => {
    return {
        title: `${postTypeEn[post.type]} ${deadlineNameEn[post.type]} in 1 Day`,
        body: `${post.title_en === "" ? post.title : post.title_en} ${deadlineNameEn[post.type]} is tomorrow.`,
        tag: post.count.toString()
    }
}));
if (data.length > 0) {
    userList.forEach(user => {
        user.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify(data)).catch(() => { })
        });
    });
}
client.close();
