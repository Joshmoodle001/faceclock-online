import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { orgName, slug, default_timezone, currency, email, password, displayName } = await request.json();

    if (!orgName || !email || !password || !displayName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        slug: slug || orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50),
        default_timezone: default_timezone || 'Africa/Johannesburg',
        currency: currency || 'ZAR',
        status: 'active',
      })
      .select('id')
      .single();

    if (orgError) {
      if (orgError.code === '23505') {
        return NextResponse.json({ error: 'Organization with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, organization_id: org.id },
    });

    if (authError || !authData.user) {
      await supabase.from('organizations').delete().eq('id', org.id);
      return NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 500 });
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        organization_id: org.id,
        display_name: displayName,
        email,
        role: 'org_admin',
        employment_status: 'active',
      });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('organizations').delete().eq('id', org.id);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, orgId: org.id });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
