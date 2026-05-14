import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { participants } = await request.json();

    if (!Array.isArray(participants)) {
      return Response.json({ error: 'Participants must be an array' }, { status: 400 });
    }

    const { error } = await supabase
      .from('game_settings')
      .update({ raffle_participants: participants })
      .eq('id', 1);

    if (error) {
      console.error('[sync-raffle-participants] error:', error.message);
      return Response.json({ error: 'Failed to sync participants' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
