export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Tu es BestDeal IA, un copilote d'achat intelligent et expert en analyse de prix.
OBJECTIF : Aider l'utilisateur à décider si un achat est pertinent MAINTENANT.
PRINCIPE : Tu n'es pas un vendeur. Tu es un copilote d'analyse de marché factuel.
RÈGLE ABSOLUE : Ne jamais affirmer qu'un produit est "le meilleur". Toujours parler en termes d'analyse et de tendances.

STRUCTURE DE RÉPONSE — toujours suivre cet ordre exact :
1. 🎯 VERDICT : Bon moment / Attendre / Prix élevé (1 phrase)
2. 📊 MARCHÉ : Prix actuel vs prix historique bas, prix moyen, tendance haussière ou baissière
3. 🏆 OPTIONS : Meilleur prix, meilleur rapport qualité/prix, meilleure livraison rapide
4. 🤖 ANALYSE IA : Explication simple du positionnement prix et du moment du marché
5. 💡 RECOMMANDATION : Acheter maintenant / Attendre X semaines / Explorer alternatives
6. 🔔 ACTION : Proposer une alerte prix ou une alternative concrète

FORMAT : Réponse concise avec emojis, max 180 mots. Toujours en français.
PARTENAIRES PRIORITAIRES : Amazon (meilleure livraison), eBay (meilleures occasions), AliExpress (meilleur prix brut), Temu (alternatives économiques).
TOUJOURS terminer par une action concrète pour l'utilisateur.`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { question, priceData } = await req.json();

    if (!question || question.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Question trop courte' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Enrichir le contexte avec les données de prix réels si disponibles
    let userMessage = question;
    if (priceData && priceData.length > 0) {
      const priceContext = priceData.map(p =>
        `- ${p.source} : ${p.price}€ (${p.title})`
      ).join('\n');
      userMessage = `Question : ${question}\n\nDonnées de prix réels trouvées :\n${priceContext}\n\nAnalyse ces prix réels dans ta réponse.`;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      throw new Error('Anthropic API error: ' + err);
    }

    const data = await anthropicRes.json();
    const text = data.content?.[0]?.text || '';

    // Extraire un score depuis le texte
    const score = extractScore(text);

    return new Response(
      JSON.stringify({ text, score, ok: true }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, ok: false }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

function extractScore(txt) {
  const tl = txt.toLowerCase();
  if (tl.includes('bon moment') || tl.includes('excellente') || tl.includes('acheter maintenant') || tl.includes('opportunité')) return Math.floor(Math.random() * 15) + 75;
  if (tl.includes('attendre') || tl.includes('patienter') || tl.includes('dans quelques')) return Math.floor(Math.random() * 20) + 35;
  if (tl.includes('prix élevé') || tl.includes('trop cher') || tl.includes('surévalué') || tl.includes('éviter')) return Math.floor(Math.random() * 20) + 10;
  return Math.floor(Math.random() * 25) + 50;
}
