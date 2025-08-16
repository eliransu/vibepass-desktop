import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { useDispatch } from 'react-redux'
import { auth } from '../../shared/firebase'
import { setUser } from '../features/auth/authSlice'

export function useAuthListener(): void {
  const dispatch = useDispatch()
  useEffect(() => {
    if (!auth) return
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        dispatch(setUser({ uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL }))
      } else {
        dispatch(setUser(null))
      }
    })
    return () => unsub()
  }, [dispatch])
}


