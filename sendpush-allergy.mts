import { MongoClient } from "mongodb";
import webpush from "web-push";
const { sendNotification, setVapidDetails } = webpush;
import dotenv from "dotenv";
import fetch from "node-fetch";

const allergyMap = [['난류', 'Eggs'], ['우유', 'Milk'], ['메밀', 'Buckwheat'], ['땅콩', 'Peanuts'], ['대두', 'Soybeans'], ['밀', 'Wheat'], ['고등어', 'Mackerel'], ['게', 'Crab'], ['새우', 'Shrimp'], ['돼지고기', 'Pork'], ['복숭아', 'Peach'], ['토마토', 'Tomato'], ['아황산류', 'Sulfur Dioxide'], ['호두', 'Walnuts'], ['닭고기', 'Chicken'], ['쇠고기', 'Beef'], ['오징어', 'Squid'], ['조개류', 'Shellfish'], ['잣', 'Pine Nuts']]


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
if (!process.env.MEAL_ATPT_OFCDC_SC_CODE || !process.env.MEAL_SD_SCHUL_CODE) process.exit();
const response = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?type=json&ATPT_OFCDC_SC_CODE=${process.env.MEAL_ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${process.env.MEAL_SD_SCHUL_CODE}&MLSV_YMD=${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).split('.').map(x => x.trim().padStart(2, '0')).splice(0, 3).join('')}`);
const data: any = await response.json();
if (!data.mealServiceDietInfo) process.exit();
const allergyList = data.mealServiceDietInfo[1].row.find((x: any) => x.MMEAL_SC_NM === '중식').DDISH_NM.split('<br/>').map((x: string) => x.trim().split(' ').reverse()[0].replace('(', '').replace(')', '').split('.').map(x => Number(x.trim())));
const uniqueList = [...new Set(allergyList.flat().filter(x => !isNaN(x)))];
userList.forEach(user => {
    if (!user.allergy.some((x: number) => uniqueList.includes(x))) return;
    user.subscriptions.forEach(async (sub: any) => {
        sendNotification(sub, JSON.stringify([{
            title: user.lang === 1 ? "Allergy Notification" : '급식 알러지 알림',
            body: user.lang === 1
            ? `Foods that cause ${user.allergy.filter((x: number) => uniqueList.includes(x)).map(x => allergyMap[x - 1][1]).join(', ')} allergies are included in the meal.`
            : `급식 중 ${user.allergy.filter((x: number) => uniqueList.includes(x)).map(x => allergyMap[x - 1][0]).join(', ')} 알러지 유발 식품이 포함되어 있습니다.`,
            tag: 'allergy',
            url: '/'
        }])).catch(() => { })
    });
});
client.close();