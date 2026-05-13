import { supabase } from '@/lib/supabaseClient';

const DICE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
type DiceColor = (typeof DICE_COLORS)[number];

function randomColor(): DiceColor {
  return DICE_COLORS[Math.floor(Math.random() * DICE_COLORS.length)];
}

export async function GET() {
  // Fetch the single game_settings row
  const { data, error } = await supabase
    .from('game_settings')
    .select('forced_color')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('[roll] Supabase error:', error.message);
    return Response.json({ error: 'Failed to fetch game settings.' }, { status: 500 });
  }

  const forcedColor: string | null = data?.forced_color ?? null;

  let dice: DiceColor[];

  if (forcedColor && forcedColor.startsWith('avoid:')) {
    // House edge mode: exclude the specified colour from the pool
    const excluded = forcedColor.slice(6) as DiceColor;
    const pool = DICE_COLORS.filter((c) => c !== excluded);
    const rnd = () => pool[Math.floor(Math.random() * pool.length)];
    dice = [rnd(), rnd(), rnd()];
  } else if (forcedColor && DICE_COLORS.includes(forcedColor as DiceColor)) {
    // Rigged mode: all 3 dice show the forced colour
    dice = [forcedColor as DiceColor, forcedColor as DiceColor, forcedColor as DiceColor];
  } else {
    // Fair play: fully random
    dice = [randomColor(), randomColor(), randomColor()];
  }

  return Response.json({
    dice,
    rigged: forcedColor !== null,
  });
}
