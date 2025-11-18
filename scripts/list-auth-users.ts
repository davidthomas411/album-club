import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
if (error) {
  console.error(error)
  process.exit(1)
}

console.table(
  data.users.map((user) => ({
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.display_name || '',
  }))
)
