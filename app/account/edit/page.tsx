'use client';

import Image from "next/image";
import Link from "next/link";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { AccountFlag, LSAccount } from "@/app/types";
import _i18n from "@/app/i18n.json";
const i18n: { [key: string]: string | string[] } = _i18n;

export default function MyAccountEditpage() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [pwd, setPwd] = useState('');
    const [hasEnc, setHasEnc] = useState(false);
    const [perm, setPerm] = useState(2);
    const [isAccepted, setIsAccepted] = useState(false);
    const [allergy, setAllergy] = useState<Array<number>>([]);
    const [flag, setFlag] = useState(0);
    const [lang, setLang] = useState(0);
    const [discordConnected, setDiscordConnected] = useState(false);
    const [discordID, setDiscordID] = useState('');
    const [saveState, setSaveState] = useState('');
    const [saveErrorMsg, setSaveErrorMsg] = useState('');
    const [isOffline, setIsOffline] = useState(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!isClient) return;
        if (account && account.id && account.token) {
            fetch('/api/account?id=' + account.id).then(async res => {
                if (res.ok) {
                    const data = (await res.json()).data;
                    setFirstName(data.firstName);
                    setLastName(data.lastName);
                    setPerm(data.perm);
                    setHasEnc(data.hasEnc);
                    setIsAccepted(data.accepted || false);
                    setAllergy(data.allergy || []);
                    setFlag(data.flag);
                    setLang(data.lang);
                    setDiscordConnected(data.discordConnected || false);
                    setDiscordID(data.discordID || '');
                    if (new URL(location.href).searchParams.has('code')) {
                        fetch('/api/discord', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: account.token! },
                            body: JSON.stringify({
                                code: new URL(location.href).searchParams.get('code')
                            })
                        }).then(async res => {
                            if (res.ok) {
                                setDiscordConnected(true);
                                setDiscordID((await res.json()).data.id);
                                setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                                router.replace('/account/edit');
                            } else {
                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                setSaveErrorMsg((await res.json()).msg);
                            }
                        }).catch(() => {
                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                        });
                    }
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
    }, [account, isClient, router, setAccount, isOffline, deviceLang]);
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
                <p>계정 정보를 수정하려면 인터넷 연결이 필요합니다.</p>
            </div>
            <div className="eng">
                <Image src="/offline.svg" alt="Offline" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>You{'\''}re offline.</h2>
                <p>An active internet connection is required to edit account details.</p>
            </div>
        </>
    ) : (
        <>
            <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
                <div className="mb-4 lg:mt-24">
                    <div className="grid grid-cols-[auto_auto_1fr]">
                        <button onClick={(e) => {
                            e.preventDefault();
                            router.back();
                        }}><Image src="/back.svg" alt="뒤로가기" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9" /></button>
                        <h1 className="text-3xl ml-4 kor">계정 정보 수정하기</h1>
                        <h1 className="text-3xl ml-4 eng">Edit Account Details</h1>
                        <div></div>
                    </div>
                    <br />
                    <h1 className="text-5xl">{isClient ? account?.id : ''}</h1>
                </div>
                <div className="lg:mt-24">
                    <span className={`kor text-right float-right whitespace-pre-line ${saveState === '저장됨' && 'text-green-500'} ${saveState === '저장 실패' && 'text-red-500'}`} >{saveState}{saveState === '저장 실패' && `\n${saveErrorMsg}`}</span>
                    <span className={`eng text-right float-right whitespace-pre-line ${saveState === 'Saved' && 'text-green-500'} ${saveState === 'Failed to Save' && 'text-red-500'}`} >{saveState}{saveState === 'Failed to Save' && `\n${saveErrorMsg}`}</span>
                    <br />
                    <br />
                    <label htmlFor="name" className="kor">이름</label>
                    <label htmlFor="name" className="eng">Name</label>
                    <br />
                    <br />
                    <input type="text" id="firstName" value={firstName} disabled={perm !== 0} className="border border-slate-400 h-12 rounded-lg p-4 mr-[5%] w-[45%] dark:bg-[#424242]" onChange={e => {
                        setFirstName(e.currentTarget.value);
                        setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                        fetch('/api/account', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                            body: JSON.stringify({
                                id: account?.id,
                                firstName: e.currentTarget.value
                            })
                        }).then(async res => {
                            if (res.ok) {
                                setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                            } else {
                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                setSaveErrorMsg((await res.json()).msg);
                            }
                        }).catch(() => {
                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                        });
                    }} />
                    <input type="text" id="lastName" value={lastName} disabled={perm !== 0} className="border border-slate-400 h-12 rounded-lg p-4 ml-[5%] w-[45%] dark:bg-[#424242]" onChange={e => {
                        setLastName(e.currentTarget.value);
                        setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                        fetch('/api/account', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                            body: JSON.stringify({
                                id: account?.id,
                                lastName: e.currentTarget.value
                            })
                        }).then(async res => {
                            if (res.ok) {
                                setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                            } else {
                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                setSaveErrorMsg((await res.json()).msg);
                            }
                        }).catch(() => {
                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                        });
                    }} />
                    <br />
                    <br />
                    <label htmlFor="passkey" className="kor">패스키</label>
                    <label htmlFor="passkey" className="eng">Passkey</label>
                    <br />
                    <Link href="/register/passkey">
                        <button id="passkey" className="w-[40%] ml-0 mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3">
                            <span className="kor">패스키 등록하기</span>
                            <span className="eng">Register a Passkey</span>
                        </button>
                    </Link>
                    <br />
                    <br />
                    <label htmlFor="enc" className="kor">PDF 암호화</label>
                    <label htmlFor="enc" className="eng">PDF Encryption</label>
                    <br />
                    {hasEnc ?
                        <>
                            <p className="kor">등록됨</p>
                            <p className="eng">Registered</p>
                            <Link href="/pdf/change">
                                <button id="enc" className="w-[40%] ml-0 mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3">
                                    <span className="kor">암호 변경하기</span>
                                    <span className="eng">Change Passcode</span>
                                </button>
                            </Link>
                        </> : <>
                            <Link href="/pdf/setup">
                                <button id="enc" className="w-[40%] ml-0 mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3">
                                    <span className="kor">등록하기</span>
                                    <span className="eng">Register</span>
                                </button>
                            </Link>
                        </>
                    }
                    <br /><br />
                    <label htmlFor="pwd" className="kor">비밀번호 변경</label>
                    <label htmlFor="pwd" className="eng">Change Password</label>
                    <br />
                    <input type="text" className="w-0 h-0 m-0 p-0" id="username" name="username" autoComplete="username" value={account?.id} readOnly />
                    <input type="password" autoComplete="new-password" id="pwd" value={pwd} className="border border-slate-400 h-12 rounded-lg p-4 w-[70%] dark:bg-[#424242]" onChange={e => {
                        setPwd(e.currentTarget.value);
                    }} />
                    <button className="w-[20%] ml-[10%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" onClick={e => {
                        e.preventDefault();
                        setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                        fetch('/api/account', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                            body: JSON.stringify({
                                id: account?.id,
                                pwd
                            })
                        }).then(async res => {
                            if (res.ok) {
                                setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                            } else {
                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                setSaveErrorMsg((await res.json()).msg);
                            }
                        }).catch(() => {
                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                        });
                    }}>
                        <span className="kor">변경</span>
                        <span className="eng">Change</span>
                    </button>
                    <br />
                    <br />
                    {process.env.NEXT_PUBLIC_DISCORD_ENABLED == "1" &&
                        <>
                            <label htmlFor="discord" className="kor">Discord 연동</label>
                            <label htmlFor="discord" className="eng">Connect to Discord</label>
                            <br />
                            {discordConnected ? (
                                <>
                                    <span className="kor">연동됨: </span>
                                    <span className="eng">Connected: </span>
                                    <span>{discordID}</span>
                                    <br />
                                    <button id="discord" className="w-[40%] ml-0 mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => {
                                        setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                                        fetch('/api/discord', {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json', Authorization: account!.token! }
                                        }).then(async res => {
                                            if (res.ok) {
                                                setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                                                setDiscordConnected(false);
                                            } else {
                                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                                setSaveErrorMsg((await res.json()).msg);
                                            }
                                        }).catch(() => {
                                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                                        });
                                    }}>
                                        <span className="kor">연동 해제</span>
                                        <span className="eng">Disconnect</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <a href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!}&response_type=code&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI!)}&scope=identify+guilds&prompt=none`}>
                                        <button id="discord" className="w-[40%] ml-0 mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3">
                                            <span className="kor">연동하기</span>
                                            <span className="eng">Connect</span>
                                        </button>
                                    </a>
                                </>
                            )}
                            <br />
                            <br />
                        </>
                    }
                    <label htmlFor="perm" className="kor">권한</label>
                    <label htmlFor="perm" className="eng">Permissions</label>
                    <br />
                    <select value={perm} id="perm" disabled={perm !== 0} className="border border-slate-400 h-12 rounded-lg pl-4 pr-4 w-full dark:bg-[#424242]" onChange={e => {
                        setPerm(parseInt(e.currentTarget.value));
                        setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                        fetch('/api/account', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                            body: JSON.stringify({
                                id: account?.id,
                                perm: parseInt(e.currentTarget.value)
                            })
                        }).then(async res => {
                            if (res.ok) {
                                setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                            } else {
                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                setSaveErrorMsg((await res.json()).msg);
                            }
                        }).catch(() => {
                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                        });
                    }}>
                        <option value={0}>root</option>
                        <option value={1}>admin</option>
                        <option value={2}>user</option>
                    </select>
                    <br />
                    <br />
                    <label htmlFor="accepted" className="kor">상태</label>
                    <label htmlFor="accepted" className="eng">Status</label>
                    <br />
                    <input type="checkbox" id="accepted" checked={isAccepted} disabled={perm !== 0} className="mr-2 h-5 mt-1 mb-1" onChange={e => {
                        setIsAccepted(e.currentTarget.checked);
                        setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                        fetch('/api/account', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                            body: JSON.stringify({
                                id: account?.id,
                                accepted: e.currentTarget.checked
                            })
                        }).then(async res => {
                            if (res.ok) {
                                setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                            } else {
                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                setSaveErrorMsg((await res.json()).msg);
                            }
                        }).catch(() => {
                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                        });
                    }} />
                    <span className="text-xl kor">{isAccepted ? '승인됨' : '승인되지 않음'}</span>
                    <span className="text-xl eng">{isAccepted ? 'Accepted' : 'Not Accepted'}</span>
                    <br />
                    <br />
                    <p className="text-sm kor">추가 권한</p>
                    <p className="text-sm eng">Additional Permissions</p>
                    {
                        [1, 2].map((currentFlag) => (
                            <div key={currentFlag}>
                                <input type="checkbox" id={`flag${currentFlag}`} checked={(flag & currentFlag) !== 0} disabled={perm !== 0} className="mr-2 h-5 mt-1 mb-1" onChange={e => {
                                    if (e.currentTarget.checked) setFlag(currentFlag | flag);
                                    else setFlag(~currentFlag & flag);
                                    setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                                    fetch('/api/account', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                                        body: JSON.stringify({
                                            id: account?.id,
                                            addFlags: e.currentTarget.checked ? currentFlag : 0,
                                            removeFlags: e.currentTarget.checked ? 0 : currentFlag
                                        })
                                    }).then(async res => {
                                        if (res.ok) {
                                            setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                                        } else {
                                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                            setSaveErrorMsg((await res.json()).msg);
                                        }
                                    }).catch(() => {
                                        setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                        setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                                    });
                                }} />
                                <span className="text-xl kor">{i18n[`flag${currentFlag}`][0]}</span>
                                <span className="text-xl eng">{i18n[`flag${currentFlag}`][1]}</span>
                                <br />
                            </div>
                        ))

                    }
                    <br />
                    <label htmlFor="lang">언어{'('}Language{')'}</label>
                    <br />
                    <select value={lang} id="lang" className="border border-slate-400 h-12 rounded-lg pl-4 pr-4 w-full dark:bg-[#424242]" onChange={e => {
                        setLang(parseInt(e.currentTarget.value));
                        const newLang = parseInt(e.currentTarget.value);
                        setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                        fetch('/api/account', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                            body: JSON.stringify({
                                id: account?.id,
                                lang: parseInt(e.currentTarget.value)
                            })
                        }).then(async res => {
                            if (res.ok) {
                                setDeviceLang(newLang);
                                setSaveState(newLang === 1 ? 'Saved' : '저장됨');
                            } else {
                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                setSaveErrorMsg((await res.json()).msg);
                            }
                        }).catch(() => {
                            setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                        });
                    }}>
                        <option value={0}>한국어</option>
                        <option value={1}>English</option>
                    </select>
                    <br />
                    <br />
                    <span className="kor">알러지 정보</span>
                    <span className="eng">Allergy Information</span>
                    <br />
                    {
                        [['난류', 'Eggs'], ['우유', 'Milk'], ['메밀', 'Buckwheat'], ['땅콩', 'Peanuts'], ['대두', 'Soybeans'], ['밀', 'Wheat'], ['고등어', 'Mackerel'], ['게', 'Crab'], ['새우', 'Shrimp'], ['돼지고기', 'Pork'], ['복숭아', 'Peach'], ['토마토', 'Tomato'], ['아황산류', 'Sulfur Dioxide'], ['호두', 'Walnuts'], ['닭고기', 'Chicken'], ['쇠고기', 'Beef'], ['오징어', 'Squid'], ['조개류', 'Shellfish'], ['잣', 'Pine Nuts']]
                            .map((i, idx) => {
                                return (
                                    <div key={idx} className="grid grid-cols-[auto_1fr]">
                                        <input type="checkbox" id={`allergy${idx + 1}`} className="mr-2 h-5 mt-1 mb-1" checked={allergy.includes(idx + 1)} onChange={e => {
                                            setAllergy(allergy.filter(i => i !== idx + 1).concat(e.currentTarget.checked ? idx + 1 : []));
                                            setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                                            fetch('/api/account', {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                                                body: JSON.stringify({
                                                    id: account?.id,
                                                    allergy: allergy.filter(i => i !== idx + 1).concat(e.currentTarget.checked ? idx + 1 : [])
                                                })
                                            }).then(async res => {
                                                if (res.ok) {
                                                    setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                                                } else {
                                                    setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                                    setSaveErrorMsg((await res.json()).msg);
                                                }
                                            }).catch(() => {
                                                setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                                setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                                            });
                                        }} />
                                        <label className="kor" htmlFor={`allergy${idx + 1}`}>{i[0]}</label>
                                        <label className="eng" htmlFor={`allergy${idx + 1}`}>{i[1]}</label>
                                    </div>
                                );
                            })
                    }
                </div>
            </div>
        </>
    );
}