import { Redirect } from 'expo-router';
// Link do QR do Mac (pilinha://sync?code=...): o PilinhaProvider lê o código; aqui só leva para o Cadastro.
export default function SyncLink() { return <Redirect href="/cadastro" />; }
