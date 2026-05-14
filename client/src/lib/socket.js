import { io } from 'socket.io-client';

const defaultServerUrl =
  typeof window === 'undefined'
    ? 'http://localhost:3001'
    : `${window.location.protocol}//${window.location.hostname}:3001`;

const URL = import.meta.env.VITE_SERVER_URL || defaultServerUrl;

export const socket = io(URL, { autoConnect: false });
