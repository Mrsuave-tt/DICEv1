import { supabase } from '@/lib/supabaseClient';

const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
type ValidColor = (typeof VALID_COLORS)[number];

/** Returns true if the value is an accepted forced_color payload. */
function isValidColor(value: unknown): boolean {
  if (value === null) return true;                                      // Fair play
  if (typeof value !== 'string') return false;
  if ((VALID_COLORS as readonly string[]).includes(value)) return true; // Exact colour
  if (value.startsWith('avoid:')) {                                     // House edge
    const target = value.slice(6);
    return (VALID_COLORS as readonly string[]).includes(target);
  }
  return false;
}

export async function POST(request: Request) {
  let body: { color?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const color = body.color ?? null;

  if (!isValidColor(color)) {
    return Response.json(
      {
        error: `Invalid color. Accepted formats: null, a colour name (${VALID_COLORS.join(', ')}), or "avoid:<colour>".`,
      },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('game_settings')
    .update({ forced_color: color as string | null })
    .eq('id', 1);

  if (error) {
    console.error('[set-winner] Supabase error:', error.message);
    return Response.json({ error: 'Failed to update game settings.' }, { status: 500 });
  }

  let message: string;
  if (color === null) {
    message = 'Fair play restored — dice will roll randomly.';
  } else if (typeof color === 'string' && color.startsWith('avoid:')) {
    const excluded = (color as string).slice(6);
    message = `House edge active — "${excluded}" excluded from all rolls.`;
  } else {
    message = `All dice are now forced to "${color}".`;
  }

  return Response.json({ success: true, forced_color: color, message });
}
