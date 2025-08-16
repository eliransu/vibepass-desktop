import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

export type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

const config: FirebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
}

function isValidConfig(c: FirebaseConfig): boolean {
  return (
    !!c.apiKey &&
    !!c.authDomain &&
    !!c.projectId &&
    !!c.storageBucket &&
    !!c.messagingSenderId &&
    !!c.appId
  )
}

export const firebaseEnabled = isValidConfig(config)

let app: ReturnType<typeof initializeApp> | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null
let _googleProvider: GoogleAuthProvider | null = null

if (firebaseEnabled) {
  app = initializeApp(config)
  _auth = getAuth(app)
  _db = getFirestore(app)
  _googleProvider = new GoogleAuthProvider()
  // Ensure OAuth persists and works across restarts in packaged app
  void setPersistence(_auth, browserLocalPersistence)
}

export const auth = _auth
export const db = _db
export const googleProvider = _googleProvider


