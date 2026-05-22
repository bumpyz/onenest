import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/providers/auth-provider';

export default function OnboardingLayout() {
    const { session, isLoading } = useAuth();
    if (isLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/sign-in" />;
    return <Stack screenOptions={{ headerShown: false }} />;
}
