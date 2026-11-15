import type { Metadata } from 'next';
import { LiveCall } from './LiveCall';

export const metadata: Metadata = { title: 'Live voice · Last Mile', description: 'Gemini Live needs intake in a simulation with synthetic residents.' };

export default function LiveCallPage() { return <LiveCall />; }
