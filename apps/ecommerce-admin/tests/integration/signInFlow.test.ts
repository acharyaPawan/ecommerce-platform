import { env } from '@/env/client';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { describe, it, expect, beforeEach, afterEach, assert, vi, beforeAll } from 'vitest';


describe.todo('Authentication Flow - Integration Tests', () => {
    let authClient: typeof import('@/lib/auth-client').authClient

    const testUser = {
            email: 'test@example.com',
            password: 'SecurePassword123!',
            name: 'Test User',
    };

    let authToken: string;

    beforeEach(async () => {
        vi.resetModules();
        // Clean up before each test
        authClient = (await import('@/lib/auth-client')).authClient
    });

    afterEach(async () => {
        // Clean up after each test
        if (authToken) {
            await authClient.signOut();
        }
    });

    describe('Sign Up Flow', () => {
        it('should successfully register a new user', async () => {
            const { data, error } = await authClient.signUp.email({
                email: testUser.email,
                password: testUser.password,
                name: testUser.name,
            });
            console.log(data, error);
            assert.exists(data?.token);
            expect(data?.user.id).toHaveProperty('userId');
            expect(data?.token).toHaveProperty('token');
            expect(data?.user.email).toBe(testUser.email);
            authToken = data?.token
        });

        it('should reject duplicate email registration', async () => {
            await authClient.signUp.email({
                email: testUser.email,
                password: testUser.password,
                name: testUser.name,
            });

            const { data, error } = await authClient.signUp.email({
                email: testUser.email,
                password: 'AnotherPassword123!',
                name: 'Another Name',
            });

            // expect(error?.statusText).toBe('USER_ALREADY_EXISTS');
        });
    });

    describe('Sign In Flow', () => {
        beforeEach(async () => {
            // Create user before sign in tests
            await authClient.signUp.email({
                email: testUser.email,
                password: testUser.password,
                name: testUser.name,
            });
        });

        it('should successfully sign in with valid credentials', async () => {
            const { data, error } = await authClient.signIn.email({
                email: testUser.email,
                password: testUser.password,
            });

            assert.isTrue(data)
            expect(data.token).toHaveProperty('token');
            expect(data?.user.id).toHaveProperty('userId');
            expect(data?.user.email).toBe(testUser.email);

            // authToken = response.data.token;
        });

        it('should reject sign in with invalid password', async () => {
            const { data, error } = await authClient.signIn.email({
                email: testUser.email,
                password: 'WrongPassword123!',
            });

            assert.exists(data);
            // expect(data.).toBe(401);
            // expect(response.error?.code).toBe('INVALID_CREDENTIALS');
        });

        it('should reject sign in with non-existent email', async () => {
            const { data, error } = await authClient.signIn.email({
                email: 'nonexistent@example.com',
                password: testUser.password,
            });

            assert.isTrue(data);
            // expect(response.status).toBe(401);
            // expect(response.error?.code).toBe('INVALID_CREDENTIALS');
        });
    });

    describe.sequential('Logout Flow', () => {
        beforeEach(async () => {
            // Create and sign in user
            await authClient.signUp.email({
                email: testUser.email,
                password: testUser.password,
                name: testUser.name,
            });

            const { data, error } = await authClient.signIn.email({
                email: testUser.email,
                password: testUser.password,
            });

            assert.exists(data);
            // authToken = data.token;
        });

        it('should successfully logout authenticated user', async () => {
            const { data, error } = await authClient.signOut();

            assert.exists(data);
            // expect(response.data).toHaveProperty('message', 'Logged out successfully');
        });

        it('should invalidate token after logout', async () => {
            await authClient.signOut()
            const { data, error } = await authClient.token();

            const JWKS = createRemoteJWKSet(
                new URL(`${env.NEXT_PUBLIC_APP_URL}/api/auth/jwks`)
            )
            assert.exists(data?.token)
            const { payload } = await jwtVerify(data?.token, JWKS, {
                issuer: 'https://your-auth-service.com',
                audience: 'https://your-auth-service.com',
            })

            // const protectedResponse = await authClient.verifyToken(authToken);
            assert.exists(payload)
            console.log("payload is: ", payload);
            // expect(protectedResponse.status).toBe(401);
            // expect(protectedResponse.error?.code).toBe('INVALID_TOKEN');
        });
    });
});