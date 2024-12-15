'use client';

import { formatDistanceStrict, sub } from "date-fns";
import { enUS, ko } from 'date-fns/locale';

import Link from "next/link";
import Dialog from "@/app/dialog";

import { LSAccount, deadlineName, deadlineNameEn } from "@/app/types";

import { useState, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

export default function Home() {
  const [isClient, setIsClient] = useState<boolean>(false);
  const [posts, setPosts] = useState<Array<{ count: number, title: string, type: number, deadline?: Date }>>([]);
  const [exam, setExam] = useState<{ year: number, semester: 1 | 2, idx: 1 | 2, subjects: Array<{ date: string, subjects: Array<string> }> } | null>(null);
  const [csat, setCsat] = useState<{ year: number, month: number, date: string, type: string } | null>(null);
  const [allergy, setAllergy] = useState<Array<number>>([]);
  const [canView, setCanView] = useState<boolean>(true);
  const [isPWA, setIsPWA] = useState<boolean>(false);
  const [dialogTtile, setDialogTitle] = useState<string>('');
  const [dialogType, setDialogType] = useState<'alert' | 'confirm'>('alert');
  const [dialogContent, setDialogContent] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [dialogCallback, setDialogCallback] = useState<{ callback: (result: boolean) => void }>({ callback: () => { } });

  const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
  const [notification, setNotification] = useLocalStorage<any>('notification', null);
  const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

  useEffect(() => {
    setIsClient(true);
  }, []);
  useEffect(() => {
    if (!account || !account.token) setCanView(false);
    else fetch('/api/posts', {
      method: 'GET',
      headers: {
        Authorization: account.token
      }
    }).then(response => {
      if (!response.ok) {
        setCanView(false);
        if (response.status === 401) {
          setAccount(null);
          setNotification(null);
        }
      } else {
        setCanView(true);
        response.json().then(data => {
          setPosts(data.posts);
          setExam(data.exam);
          setCsat(data.csat);
        });
      }
    })
  }, [account, setAccount, setNotification]);
  useEffect(() => {
    if (!isClient) return;
    if (account && account.id && account.token) {
      fetch('/api/account?id=' + account.id).then(async res => {
        if (res.ok) {
          setAllergy((await res.json()).data.allergy);
        }
      })
    }
  }, [account, isClient]);
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPWA(true);
    }
  }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);
  useEffect(() => {
    if (posts.length === 0) return;
    posts.forEach(post => {
      fetch(`/post/${post.count}`).catch(() => { }); // cache to service worker
    });
    if (account && account.token) {
      posts.forEach(post => {
          fetch(`/api/post/${post.count}`, {
              method: 'GET',
              headers: {
                  Authorization: account.token!
              }
          }).catch(() => { }); // cache to service worker
      });
  }
  }, [posts, account]);

  return (
    <div className="w-[90%] md:w-[700px] md:border md:border-slate-400 md:p-8 md:rounded-lg ml-auto mr-auto">
      {canView && isClient ?
        <>
          {notification == null ?
            <>
              <button className={`ml-[20%] w-[40%] mr-0 pt-3 pb-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring`} onClick={async e => {
                if (!('serviceWorker' in navigator)) {
                  setDialogTitle(deviceLang === 1 ? "Unsupported Browser" : '지원하지 않는 브라우저');
                  setDialogType('alert');
                  setDialogContent(deviceLang === 1 ? "This browser doesn't support notifications." : '이 브라우저는 알림을 지원하지 않습니다.');
                  setDialogOpen(true);
                  return;
                }
                if (!isPWA) {
                  setDialogTitle(deviceLang === 1 ? "Install PWA" : 'PWA 설치');
                  setDialogType('alert');
                  setDialogContent(deviceLang === 1
                    ? "PWA installation is required to receive notifications. On computers, install through the icon on the right side of the address bar.\nOn Android Chrome, install through the 'Install app' in the right menu of the address bar.\nOn Samsung Internet, install through the button on the right side of the address bar.\nOn iOS Safari, install by pressing 'Add to Home Screen' (an app is installed instead of a shortcut on this site).\n\nAfter installing PWA, run it and press 'Receive notifications'.\nIf the notification settings are successful, this button will disappear."
                    : '알림을 받으려면 PWA 설치가 필요합니다.\n\n컴퓨터에서는 주소창 오른쪽에 있는 아이콘을 클릭하여 설치합니다.\nAndroid Chrome에서는 주소창 오른쪽 메뉴에서 "앱 설치"를 통해 설치합니다.\n삼성 인터넷에서는 주소창 오른쪽 버튼을 통해 설치합니다.\niOS용 Safari에서는 공유-홈 화면에 추가(이 사이트에서는 바로가기 대신 앱이 설치됨)를 눌러 설치합니다.\n\nPWA를 설치한 다음 이를 실행하여 알림 받기를 누르세요.\n알림 설정에 성공한 경우 이 버튼이 없어집니다.');
                  setDialogOpen(true);
                } else {
                  if (Notification.permission === 'default') {
                    setDialogTitle(deviceLang === 1 ? "Receive Notifications" : '알림 설정하기');
                    setDialogType('confirm');
                    setDialogContent(deviceLang === 1 ? "To get notifications about new assignments and deadlines, press OK and allow notifications." : '과제 등록, 마감 알림을 받으려면 확인을 누른 다음 알림을 허용해주세요.');
                    setDialogCallback({
                      callback: (result: boolean) => {
                        if (!result) return;
                        Notification.requestPermission().then(async permission => {
                          if (permission === 'granted') {
                            const registration = await navigator.serviceWorker.ready;
                            const subscription = await registration.pushManager.subscribe({
                              applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBKEY,
                              userVisibleOnly: true,
                            });
                            await fetch('/api/subscribe', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: account?.token ?? ''
                              },
                              body: JSON.stringify(subscription)
                            }).then(res => {
                              if (!res.ok) {
                                setDialogTitle(deviceLang === 1 ? "Failed to Subscribe" : '알림 구독 실패');
                                setDialogType('alert');
                                setDialogContent(deviceLang === 1 ? "Failed to subscribe to notifications." : '알림 구독에 실패했습니다.');
                              } else {
                                setNotification(subscription);
                              }
                            });
                          } else {
                            setDialogTitle(deviceLang === 1 ? "Notifications Blocked" : '알림 차단됨');
                            setDialogType('alert');
                            setDialogContent(deviceLang === 1 ? "Notifications are blocked." : '알림이 차단되었습니다.');
                            setDialogOpen(true);
                          }
                        });
                      }
                    });
                    setDialogOpen(true);
                  } else if (Notification.permission === 'granted') {
                    const registration = await navigator.serviceWorker.ready;
                    const subscription = await registration.pushManager.subscribe({
                      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBKEY,
                      userVisibleOnly: true,
                    });
                    await fetch('/api/subscribe', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: account?.token ?? ''
                      },
                      body: JSON.stringify(subscription)
                    }).then(res => {
                      if (!res.ok) {
                        setDialogTitle(deviceLang === 1 ? "Failed to Subscribe" : '알림 구독 실패');
                        setDialogType('alert');
                        setDialogContent(deviceLang === 1 ? "Failed to subscribe to notifications." : '알림 구독에 실패했습니다.');
                      } else {
                        setNotification(subscription);
                      }
                    });
                  } else {
                    setDialogTitle(deviceLang === 1 ? "Notifications Blocked" : '알림 차단됨');
                    setDialogType('alert');
                    setDialogContent(deviceLang === 1 ? "Notifications are blocked, so it is unable to request permissions.\nPlease manually allow notifications from the browser settings to receive notifications." : '알림이 차단되어 있어 권한을 요청할 수 없습니다.\n알림을 받기 위해서는 브라우저 설정에서 직접 알림 권한을 허용해주세요.');
                    setDialogOpen(true);
                  }
                }
              }}>
                <span className="kor">알림 받기</span>
                <span className="eng">Receive Notifications</span>
              </button>
              <Link href="/write">
                <button className={`ml-[10%] w-[30%] mr-0 pt-3 pb-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring`}>
                  <span className="kor">글쓰기</span>
                  <span className="eng">Write</span>
                </button>
              </Link>
            </>
            : <Link href="/write">
              <button className={`ml-[70%] w-[30%] mr-0 pt-3 pb-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring`}>
                <span className="kor">글쓰기</span>
                <span className="eng">Write</span>
              </button>
            </Link>
          }
          <br />
          <br />
          <button className="w-1/2 border-r border-r-slate-400 text-center" onClick={(() => {
            fetch('/api/timetable').then(async r => {
              if (r.status === 500) {
                setDialogTitle(deviceLang === 1 ? "Comcigan Setup Required" : '컴시간 설정 필요');
                setDialogType('alert');
                setDialogContent((await r.json()).msg);
                setDialogOpen(true);
              } else if (r.ok) {
                r.json().then(data => {
                  const todayTimetable = (data.data.timetable[new Date().getDay() - 1] ?? []).filter((x: any) => x.subject !== '');
                  if (todayTimetable.length === 0) {
                    setDialogTitle(deviceLang === 1 ? "No Class" : '수업 없음');
                    setDialogType('alert');
                    setDialogContent(deviceLang === 1 ? "There are no classes today." : '오늘은 수업이 없습니다.');
                    setDialogOpen(true);
                    return;
                  }
                  setDialogTitle(deviceLang === 1 ? "Timetable" : '시간표');
                  setDialogType('alert');
                  setDialogContent(todayTimetable.map((x: { subject: string, teacher: string, prevData?: { subject: string, teacher: string } }, idx: number) => `${deviceLang === 1 && "Period #"}${idx + 1}${deviceLang === 0 && "교시"}: ${x.subject}(${x.teacher} ${deviceLang === 1 ? "Teacher" : "교사"})${x.prevData ? ` (${deviceLang === 1 ? "Before Change" : "변경 전"}: ${x.prevData.subject === '' ? (deviceLang === 1 ? "No Class" : "수업 없음") : `${x.prevData.subject}(${x.prevData.teacher} ${deviceLang === 1 ? "Teacher" : "교사"})`})` : ''}`).join('\n'));
                  setDialogOpen(true);
                });
              }
            })
          })}>
            <span className="kor">시간표</span>
            <span className="eng">Timetable</span>
          </button>
          <button className="w-1/2 text-center" onClick={(() => {
            fetch('/api/meal').then(async r => {
              if (r.status === 500) {
                setDialogTitle(deviceLang === 1 ? "Meal Info Setup Required" : '급식 정보 설정 필요');
                setDialogType('alert');
                setDialogContent((await r.json()).msg);
                setDialogOpen(true);
              } else if (r.ok) {
                r.json().then(data => {
                  setDialogTitle(deviceLang === 1 ? "Meal" : '식단표');
                  setDialogType('alert');
                  setDialogContent(data.data.meals.map(
                    (x: string) => x.split(' ').reverse()[0].replace('(', '').replace(')', '').split('.').map((y: string) => Number(y.trim())).some((y: number) => allergy.includes(y)) ? `${x} (${deviceLang === 1 ? "Allergic" : "알러지 있음"})` : x
                  ).join('\n') + `\n\n${deviceLang === 1 ? "Calories" : "열량"}: ` + data.data.calories + 'Kcal');
                  setDialogOpen(true);
                });
              } else {
                setDialogTitle(deviceLang === 1 ? "No Meal Information" : '급식 정보 없음');
                setDialogType('alert');
                setDialogContent((await r.json()).msg);
                setDialogOpen(true);
              }
            })
          })}>
            <span className="kor">급식</span>
            <span className="eng">Meal</span>
          </button>
          <br />
          <br />
          {(exam || csat) &&
            <div className="border-t border-t-slate-400 w-full grid grid-cols-2 pt-8 pb-8">
              <span className="border-r border-r-slate-400 pl-4 pr-4 flex flex-col align-middle justify-center h-full">
                <p className="text-center kor">{exam ? `${exam.year}년 ${exam.semester}학기 ${exam.idx}차 지필평가` : '지필평가'}</p>
                <p className="text-center eng">{exam ? `Year ${exam.year} Semester` : 'Exam'}</p>
                <p className="test-center eng">{exam && `${exam.semester}${exam.idx === 1 ? 'First' : 'Second'} Exam`}</p>
                <h1 className="text-3xl sm:text-4xl md:text-6xl text-center">{exam ? (
                  (new Date() as unknown as number) <= (new Date(exam.subjects[0].date) as unknown as number) ?
                    <p>{`D-${Math.ceil((new Date(exam.subjects[0].date) as unknown as number - (new Date() as unknown as number)) / 1000 / 60 / 60 / 24)}`}</p>
                    : (
                      (new Date(exam.subjects.slice(-1)[0].date) as unknown as number) <= (new Date() as unknown as number - 9.5 * 60 * 60 * 1000) ?
                        <>
                          <p className="whitespace-nowrap kor">시험 종료</p>
                          <p className="text-base kor">수고하셨습니다!</p>
                          <p className="whitespace-nowrap eng">Exam Ended</p>
                          <p className="text-base eng">Congratulations!</p>
                        </>
                        : <>
                          <p className="kor">{exam.subjects.indexOf(exam.subjects.find(subj => (new Date(subj.date) as unknown as number) - new Date().setHours(0, 0, 0, 0) === 0)!) + 1}일차</p>
                          <p className="eng">Day {exam.subjects.indexOf(exam.subjects.find(subj => (new Date(subj.date) as unknown as number) - new Date().setHours(0, 0, 0, 0) === 0)!) + 1}</p>
                          <p className="text-base whitespace-pre-line kor">{exam.subjects.find(subj => (new Date(subj.date) as unknown as number) - new Date().setHours(0, 0, 0, 0) === 0)?.subjects.map((x, idx) => `${idx + 1}교시 ${x[0]}`).join('\n') || '오늘 시험 과목 없음'}</p>
                          <p className="text-base whitespace-pre-line eng">{exam.subjects.find(subj => (new Date(subj.date) as unknown as number) - new Date().setHours(0, 0, 0, 0) === 0)?.subjects.map((x, idx) => `Period ${idx + 1}: ${x[1]}`).join('\n') || 'No Exams Today'}</p>
                        </>
                    )) : <p className="whitespace-nowrap">
                  <span className="kor">시험 없음</span>
                  <span className="eng">No Exams</span>
                </p>
                }</h1>
              </span>
              <span className="pl-4 pr-4 flex flex-col align-middle justify-center h-full">
                <p className="text-center kor">{csat ? `${csat.year}년 ${csat.month}월` : ''}</p>
                <p className="text-center eng">{csat ? `${csat.year}/${csat.month}` : ''}</p>
                <p className="text-center kor">{csat ? csat.type : '수능형 시험'}</p>
                <p className="text-center eng">{csat ? csat.type : 'CSAT-like Exams'}</p>
                <h1 className="text-3xl sm:text-4xl md:text-6xl text-center">{csat ? (
                  (new Date() as unknown as number) <= (new Date(csat.date) as unknown as number) ?
                    <p>{`D-${Math.ceil((new Date(csat.date) as unknown as number - (new Date() as unknown as number)) / 1000 / 60 / 60 / 24)}`}</p>
                    : (
                      (new Date(csat.date) as unknown as number) <= (new Date() as unknown as number - 9.5 * 60 * 60 * 1000) ?
                        <>
                          <p className="whitespace-nowrap kor">시험 종료</p>
                          <p className="text-base kor">수고하셨습니다!</p>
                          <p className="whitespace-nowrap eng">Exam Ended</p>
                          <p className="text-base eng">Congratulations!</p>
                        </>
                        : <p>D-Day</p>
                    )) : <p className="whitespace-nowrap">
                  <span className="kor">시험 없음</span>
                  <span className="eng">No Exams</span>
                </p>
                }</h1>
              </span>
            </div>
          }
          {posts.map((post, idx) => {
            return (
              <Link key={post.count} href={`/post/${post.count}`}>
                <div className="border-t border-t-slate-400">
                  <br />
                  <h1 className="text-4xl inline">{post.title}</h1>
                  <div className={`kor ${post.deadline && (new Date(post.deadline) as unknown as number - 0) >= new Date().setHours(0, 0, 0, 0) && (new Date(post.deadline) as unknown as number - 0) - new Date().setHours(0, 0, 0, 0) <= 1000 * 60 * 60 * 24 * 2 && 'text-red-500'}`}>{Number(post.type) === 0 && <><p className="text-red-500 inline font-bold">중요</p> | </>}{deadlineName[post.type ?? 5]}: {post.deadline ? `${(new Date(post.deadline) as unknown as number - 0) == new Date().setHours(0, 0, 0, 0) ? '오늘' : formatDistanceStrict(new Date(post.deadline), new Date(new Date().setHours(0, 0, 0, 0)), { locale: ko, addSuffix: true })}(${new Date(post.deadline).toLocaleDateString('ko-KR', {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  })})` : '없음'}</div>
                  <div className={`eng ${post.deadline && (new Date(post.deadline) as unknown as number - 0) >= new Date().setHours(0, 0, 0, 0) && (new Date(post.deadline) as unknown as number - 0) - new Date().setHours(0, 0, 0, 0) <= 1000 * 60 * 60 * 24 * 2 && 'text-red-500'}`}>{Number(post.type) === 0 && <><p className="text-red-500 inline font-bold">Important</p> | </>}{deadlineNameEn[post.type ?? 5]}: {post.deadline ? `${(new Date(post.deadline) as unknown as number - 0) == new Date().setHours(0, 0, 0, 0) ? 'Today' : formatDistanceStrict(new Date(post.deadline), new Date(new Date().setHours(0, 0, 0, 0)), { locale: enUS, addSuffix: true })}(${new Date(post.deadline).toLocaleDateString('en-US', {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                  })})` : 'None'}</div>
                </div>
                <br />
              </Link>
            );
          })}
        </>
        : (
          (account && account.token && isClient) ? (
            <div className="bg-red-500 p-4 border border-red-500 rounded text-white">
              <p className="kor">관리자의 계정 승인이 필요합니다.</p>
              <p className="eng">Administrator approval is required.</p>
            </div>
          ) : (
            <div className="bg-red-500 p-4 border border-red-500 rounded text-white">
              <p className="kor">로그인이 필요합니다.</p>
              <p className="eng">Please login.</p>
            </div>
          )
        )
      }
      {dialogOpen && <Dialog title={dialogTtile} type={dialogType} content={dialogContent} setShowDialog={setDialogOpen} callback={dialogCallback.callback} />}
    </div>
  );
}
