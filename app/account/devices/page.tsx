'use client';

import Image from "next/image";
import Link from "next/link";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount, Device, permToString, langToString, AccountFlag } from "@/app/types";
import _i18n from "@/app/i18n.json";
const i18n: { [key: string]: string | string[] } = _i18n;

export default function MyAccountInfoPage() {
    const router = useRouter();
    const [devices, setDevices] = useState<Array<Device> | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [notification, setNotification] = useLocalStorage<any>('notification', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);
    const [encv2prf, setEncv2prf] = useLocalStorage<boolean>('encv2prf', false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!isClient) return;
        if (account && account.id && account.token) {
            fetch('/api/account/devices', {
                headers: {
                    Authorization: account.token
                }
            }).then(async res => {
                if (res.ok) {
                    setDevices((await res.json()).data);
                } else {
                    setAccount(null);
                    router.replace('/login/id');
                }
            }).catch(() => {
                setIsOffline(true);
            })
        } else {
            router.replace('/login/id');
        }
    }, [account, isClient, router, setAccount, isOffline]);
    useEffect(() => {
        if (isOffline) {
            const interval = setInterval(() => {
                fetch('/api/is_online').then(() => {
                    setIsOffline(false);
                }).catch(() => {
                    setIsOffline(true);
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isOffline]);

    return isOffline ? (
        <>
            <div className="kor">
                <Image src="/offline.svg" alt="오프라인 상태" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>오프라인 상태입니다.</h2>
                <p>기기 목록을 확인하려면 인터넷 연결이 필요합니다.</p>
            </div>
            <div className="eng">
                <Image src="/offline.svg" alt="Offline" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>You{'\''}re offline.</h2>
                <p>An active internet connection is required to view devices.</p>
            </div>
        </>
    ) : (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <div className="grid grid-cols-[auto_auto_1fr]">
                    <button onClick={(e) => {
                        e.preventDefault();
                        router.back();
                    }}><Image src="/back.svg" alt="뒤로가기" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9" /></button>
                    <h1 className="text-3xl ml-4 kor">기기 목록</h1>
                    <h1 className="text-3xl ml-4 eng">Devices</h1>
                    <div></div>
                </div>
            </div>
            <div className="lg:mt-24">
                <>
                    <button className="p-3 mt-4 w-full rounded-lg bg-red-500 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => {
                        fetch('/api/logout/all', {
                            method: 'DELETE',
                            headers: {
                                Authorization: account!.token!
                            }
                        }).then(async () => {
                            setAccount(null);
                            setNotification(null);
                            setEncv2prf(false);
                            localStorage.removeItem('key');
                            localStorage.removeItem('iv');
                            if ('serviceWorker' in navigator) {
                                const registration = await navigator.serviceWorker.ready;
                                const subscription = await registration.pushManager.getSubscription();
                                if (subscription) {
                                    await subscription.unsubscribe();
                                }
                            }
                            setDeviceLang(navigator.language.startsWith('en') ? 1 : 0);
                            router.push('/');
                        });
                    }}>
                        <span className="kor">모두 로그아웃</span>
                        <span className="eng">Logout All</span>
                    </button>
                    <br /><br />
                    {devices ? [devices.find(d => d.isMySession), ...devices.filter(d => !d.isMySession)].filter(d => d != null).map(device => (
                        <div key={device.deviceID} className={`p-4 mb-4 rounded-lg border ${device.isMySession ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-700'} `}>
                            {device.isMySession && <>
                                <div className="kor">현재 세션</div>
                                <div className="eng">Current Session</div>
                                <br />
                            </>}
                            <p className="text-sm kor">기기</p>
                            <p className="text-sm eng">Device</p>
                            <p className="text-xl">{device.device}</p>
                            <br />
                            <p className="text-sm kor">브라우저</p>
                            <p className="text-sm eng">Browser</p>
                            <p className="text-xl">{device.browser}</p>
                            <br />
                            <p className="text-sm kor">최초 로그인</p>
                            <p className="text-sm eng">First Login</p>
                            <p className="text-xl">{new Date(device.issuedAt).toLocaleString(deviceLang == 0 ? 'ko-KR' : 'en-US', {
                                timeZone: 'Asia/Seoul'
                            })}</p>
                            <br />
                            <p className="text-sm kor">마지막 접속</p>
                            <p className="text-sm eng">Last Login</p>
                            <p className="text-xl">{new Date(device.lastAccess).toLocaleString(deviceLang == 0 ? 'ko-KR' : 'en-US', {
                                timeZone: 'Asia/Seoul'
                            })}</p>
                            <br />
                            <button className="p-3 mt-4 ml-4 rounded-lg bg-red-500 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" disabled={device.isMySession} onClick={() => {
                                fetch(`/api/account/devices?device_id=${device.deviceID}`, {
                                    method: 'DELETE',
                                    headers: {
                                        Authorization: account!.token!
                                    }
                                }).then(async () => {
                                    setDevices(devices.filter(d => d.deviceID !== device.deviceID));
                                });
                            }}>
                                <span className="kor">로그아웃</span>
                                <span className="eng">Logout</span>
                            </button>
                        </div>
                    )) : (
                        <>
                            <p className="kor">불러오는 중...</p>
                            <p className="eng">Loading...</p>
                        </>
                    )}
                </>
            </div>
        </div>
    );
}