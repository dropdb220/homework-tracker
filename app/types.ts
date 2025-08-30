import type { AuthenticatorTransportFuture, CredentialDeviceType } from '@simplewebauthn/browser';
import type { Binary } from 'mongodb';

export type LSAccount = {
    token?: string;
    id?: string;
}

export type LSNewAccount = {
    id: string;
    authType: 'password' | 'passkey';
    pwd?: string;
    passkey?: any;
}

export enum Perm {
    root = 0,
    admin = 1,
    user = 2
}

export enum Lang {
    ko = 0,
    en = 1
}

export enum PrintStatus {
    pending = 0,
    completed = 1,
    rejected = 2
}

export type AccountInfo = {
    id: string;
    firstName: string;
    lastName: string;
    perm: Perm;
    accepted: boolean;
    flag: number;
    lang: Lang;
}

export enum AccountFlag {
    answerer = 1,
    printer = 2
}

export const permToString = ['root', 'admin', 'user', ''];

export const langToString = ['한국어', 'English', ''];

export const postType: { [index: number]: string } = ['중요', '지필평가', '수행평가', '숙제', '기타', ''];
export const postTypeEn: { [index: number]: string } = ['Important', 'Exam', 'Performance', 'Homework', 'Other', ''];

export const deadlineName: { [index: number]: string } = ['기한', '날짜', '날짜', '마감 기한', '날짜/기한', ''];
export const deadlineNameEn: { [index: number]: string } = ['Deadline', 'Date', 'Date', 'Deadline', 'Date(Deadline)', ''];

export type Passkey = {
    // SQL: Encode to base64url then store as `TEXT`. Index this column
    credentialID: string;
    // SQL: Store raw bytes as `BYTEA`/`BLOB`/etc...
    credentialPublicKey: Uint8Array;
    // SQL: Consider `BIGINT` since some authenticators return atomic timestamps as counters
    counter: number;
    // SQL: `VARCHAR(32)` or similar, longest possible value is currently 12 characters
    // Ex: 'singleDevice' | 'multiDevice'
    credentialDeviceType: CredentialDeviceType;
    // SQL: `BOOL` or whatever similar type is supported
    credentialBackedUp: boolean;
    // SQL: `VARCHAR(255)` and store string array as a CSV string
    // Ex: ['ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb']
    transports?: AuthenticatorTransportFuture[];
};

export type PasskeySerialized = {
    // SQL: Encode to base64url then store as `TEXT`. Index this column
    credentialID: string;
    // SQL: Store raw bytes as `BYTEA`/`BLOB`/etc...
    credentialPublicKey: Binary;
    // SQL: Consider `BIGINT` since some authenticators return atomic timestamps as counters
    counter: number;
    // SQL: `VARCHAR(32)` or similar, longest possible value is currently 12 characters
    // Ex: 'singleDevice' | 'multiDevice'
    credentialDeviceType: CredentialDeviceType;
    // SQL: `BOOL` or whatever similar type is supported
    credentialBackedUp: boolean;
    // SQL: `VARCHAR(255)` and store string array as a CSV string
    // Ex: ['ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb']
    transports?: AuthenticatorTransportFuture[];
};