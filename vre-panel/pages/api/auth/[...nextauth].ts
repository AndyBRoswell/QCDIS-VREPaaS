import axios from "axios";
import NextAuth from "next-auth"
import { Session } from "next-auth";
import { JWT } from "next-auth/jwt";
import KeycloakProvider from "next-auth/providers/keycloak"
import type { NextApiRequest, NextApiResponse } from 'next'

import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

const refreshAccessToken = async (token: JWT) => {
	try {
		// Get a new set of tokens with a refreshToken
		// console.log("AUTH0_ISSUER", process.env.AUTH0_ISSUER)
		const tokenResponse = await axios.post(
			process.env.AUTH0_ISSUER + '/protocol/openid-connect/token',
			{
				grant_type: 'refresh_token',
				refresh_token: token.refreshToken,
				client_id: process.env.AUTH0_ID,
				client_secret: process.env.AUTH0_SECRET,
				requested_token_type: 'urn:ietf:params:oauth:token-type:refresh_token'
			},
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			}
		);

		// console.log(tokenResponse);

		return {
			...token,
			accessToken: tokenResponse.data.access_token,
			accessTokenExpiry: Date.now() / 1e3 + tokenResponse.data.expires_in,
			refreshToken: tokenResponse.data.refresh_token,
		}
	} catch (error) {
		console.log('Caught exception in refreshAccessToken')
		console.log(error)
		return {
			...token,
			error: "RefreshAccessTokenError",
		}
	}
};

export default (req : NextApiRequest, res: NextApiResponse) => {
	return NextAuth(req, res, {
		providers: [
			KeycloakProvider({
				clientId: process.env.AUTH0_ID,
				clientSecret: process.env.AUTH0_SECRET,
				issuer:  process.env.AUTH0_ISSUER,
			})
		],
		secret:  process.env.SECRET,
		callbacks: {
			async jwt({ token, user, account }) {
				if (account && user) {
					token.accessToken = account.access_token;
					token.refreshToken = account.refresh_token;
					token.accessTokenExpiry = account.expires_at;
				}

				if (token.accessTokenExpiry) {
					const expDate = new Date(token.accessTokenExpiry * 1e3)
					const nowDate = new Date()
					const tokenExpired = (expDate < nowDate)
					if (tokenExpired) {
						token = await refreshAccessToken(token);
					}
				}

				return token;

			},
			async session({ session, token }: { session: Session, token: JWT }) {
				if (token) {
					session.error = token.error;
					session.accessToken = token.accessToken;
					session.accessTokenExpiry = token.accessTokenExpiry;
				}
				return session;
			},
		},
		pages: {
			signIn: `${publicRuntimeConfig.basePath}/auth/signin`
		},
	})

}