import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { auth } from './firebase';
import { dbService } from './dbService';
import { UserProfile } from '../types';

export const authService = {
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },

  onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  async login(email: string, pass: string): Promise<FirebaseUser> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  },

  async register(email: string, pass: string, name: string, mobile?: string): Promise<{ user: FirebaseUser; profile: UserProfile }> {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });

    const now = Date.now();
    const profile: UserProfile = {
      userId: cred.user.uid,
      name,
      email,
      mobile: mobile || null,
      photoUrl: null,
      defaultTenantId: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`users/${cred.user.uid}`, profile);
    return { user: cred.user, profile };
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return await dbService.get<UserProfile>(`users/${userId}`);
  },

  async updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    await dbService.update(`users/${userId}`, {
      ...data,
      updatedAt: Date.now(),
    });
  }
};
