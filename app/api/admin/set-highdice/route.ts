import { supabase } from '@/lib/supabaseClient';

const VALID_OPTIONS = ['Random', '1', '2', '3', '4', '5', '6', 'avoid:1', 'avoid:2', 'avoid:3', 'avoid:4', 'avoid:5', 'avoid:6'];

export async function POST(request: Request) {
  let body: { left?: unknown; right?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const left = typeof body.left === 'string' ? body.left : 'Random';
  const right = typeof body.right === 'string' ? body.right : 'Random';

  if (!VALID_OPTIONS.includes(left) || !VALID_OPTIONS.includes(right)) {
    return Response.json({ error: 'Invalid high dice option.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('game_settings')
    .update({ 
      high_dice_left: left,
      high_dice_right: right 
    })
    .eq('id', 1);

  if (error) {
    console.error('[set-highdice] Supabase error:', error.message);
    return Response.json({ error: 'Failed to update high dice settings.' }, { status: 500 });
  }

  return Response.json({ success: true, left, right });
}
