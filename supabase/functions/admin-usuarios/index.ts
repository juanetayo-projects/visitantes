import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(url, service)
    const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
    if (perfil?.rol !== 'admin') return json({ error: 'Solo administradores pueden gestionar usuarios.' }, 403)

    const body = await req.json()

    if (body.action === 'create') {
      const { email, password, nombre, rol } = body
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nombre },
      })
      if (error) return json({ error: error.message }, 400)
      await admin.from('perfiles').update({ nombre, rol, activo: true }).eq('id', data.user.id)
      return json({ ok: true, id: data.user.id })
    }
    if (body.action === 'delete') {
      if (body.id === user.id) return json({ error: 'No puedes eliminar tu propio usuario.' }, 400)
      const { error } = await admin.auth.admin.deleteUser(body.id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }
    if (body.action === 'password') {
      const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }
    return json({ error: 'Acción no válida' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
