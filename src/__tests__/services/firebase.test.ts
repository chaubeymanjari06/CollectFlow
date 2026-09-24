import { describe, it, expect } from 'vitest';
import { firebaseConfig, app } from '../../services/firebase';

describe('Firebase Platform Service', () => {
  it('should initialize Firebase App singleton', () => {
    expect(app).toBeDefined();
    expect(app.name).toBe('[DEFAULT]');
  });

  it('should load project credentials for collectflow-320c4', () => {
    expect(firebaseConfig.projectId).toBe('collectflow-320c4');
    expect(firebaseConfig.authDomain).toContain('collectflow-320c4.firebaseapp.com');
    expect(firebaseConfig.apiKey).toBeDefined();
    expect(firebaseConfig.databaseURL).toBe('https://collectflow-320c4-default-rtdb.asia-southeast1.firebasedatabase.app/');
  });
});
