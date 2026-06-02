import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, display_name, employee_code, organization_id } = await request.json()
    if (!email || !password || !display_name || !organization_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
    if (authError) {
      if (authError.message?.includes('already been registered')) return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
      throw authError
    }

    if (authUser?.user) {
      await supabase.from('profiles').insert({ user_id: authUser.user.id, organization_id, display_name, email, employee_code: employee_code || null, role: 'employee' })
    }

    return NextResponse.json({ success: true, user_id: authUser?.user?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
