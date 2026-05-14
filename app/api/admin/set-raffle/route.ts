import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { winnerName } = await request.json();

    const { error } = await supabase
      .from('game_settings')
      .update({ raffle_override: winnerName })
      .eq('id', 1);

    if (error) {
      console.error('[set-raffle] error:', error.message);
      return Response.json({ error: 'Failed to set raffle override' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
