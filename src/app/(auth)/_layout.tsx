import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/providers/auth-provider';

export default function AuthLayout() {
    const { session, isLoading } = useAuth();
    if (isLoading) return <LoadingScreen />;
    if (session) return <Redirect href="/" />;
    return <Stack screenOptions={{ headerShown: false }} />;
}
