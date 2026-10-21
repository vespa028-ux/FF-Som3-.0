import { useAuth } from './auth.jsx'
import { useShop } from './shop.jsx'
import { hasPerm } from './perms'

// const perm = usePerm();  perm('tx.delete') → true/false
export function usePerm() {
  const { role } = useAuth()
  const { shop } = useShop()
  return (key) => hasPerm(role, shop.permissions, key)
}
