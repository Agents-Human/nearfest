import { api } from './api';
import { createAccountSession } from './account-session';

export const signInAccount = createAccountSession(api);
