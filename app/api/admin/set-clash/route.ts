import { supabase } from '@/lib/supabaseClient';

const VALID_COLORS = ['Random', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple'] as const;

function isValidOption(value: string): boolean {
  if (VALID_COLORS.includes(value as any)) return true;
  if (value.startsWith('avoid:')) {
    const color = value.slice(6);
    return VALID_COLORS.includes(color as any) && color !== 'Random';
  }
  return false;
}

export async function POST(request: Request) {
  let body: { left?: unknown; right?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const left = typeof body.left === 'string' ? body.left : 'Random';
  const right = typeof body.right === 'string' ? body.right : 'Random';

  if (!isValidOption(left) || !isValidOption(right)) {
    return Response.json({ error: 'Invalid color option.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('game_settings')
    .update({ 
      clash_left_color: left,
      clash_right_color: right 
    })
    .eq('id', 1);

  if (error) {
    console.error('[set-clash] Supabase error:', error.message);
    return Response.json({ error: 'Failed to update clash settings.' }, { status: 500 });
  }

  return Response.json({ success: true, left, right });
}
