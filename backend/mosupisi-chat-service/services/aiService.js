// AI Service with agricultural knowledge base for Lesotho
const axios = require('axios');

class AIService {
  constructor() {
    this.plantingGuideUrl = process.env.PLANTING_GUIDE_SERVICE_URL;
    this.agrometUrl = process.env.AGROMET_API_URL;
    
    // Agricultural knowledge base for Lesotho
    this.knowledgeBase = {
      crops: {
        maize: {
          varieties: ['PAN 53', 'SC 719', 'ZM 621'],
          planting: 'October to December',
          spacing: '75cm between rows, 25cm within rows',
          fertilizer: 'Basal: 2:3:2 (22) + Zn at planting, Top-dress: LAN at 4-6 weeks',
          water: 'Critical at tasseling and silking',
          pests: ['Stalk borer', 'Cutworm', 'Armyworm'],
          diseases: ['Maize streak virus', 'Gray leaf spot']
        },
        sorghum: {
          varieties: ['MR Buster', 'NS 5511', 'Segaolane'],
          planting: 'October to January',
          spacing: '75cm between rows, 15cm within rows',
          fertilizer: '2:3:2 (22) at planting, LAN at 4 weeks',
          water: 'Drought tolerant, critical at flowering',
          pests: ['Shoot fly', 'Midge', 'Birds'],
          diseases: ['Covered smut', 'Anthracnose']
        },
        legumes: {
          varieties: ['Beans: PAN 148', 'Cowpea: Bechuana white'],
          planting: 'October to February',
          spacing: '45cm between rows, 10cm within rows',
          fertilizer: 'Single super phosphate at planting, no nitrogen needed',
          water: 'Critical at flowering and pod filling',
          pests: ['Aphids', 'Pod borer'],
          diseases: ['Rust', 'Angular leaf spot']
        }
      },
      
      // Soil types in Lesotho
      soils: {
        'lowlands': 'Sandy loam, moderate fertility',
        'foothills': 'Clay loam, good fertility',
        'mountains': 'Sandy, low fertility'
      },
      
      // Common advice templates
      adviceTemplates: {
        fertilizer: (crop, location) => {
          const cropData = this.knowledgeBase.crops[crop] || this.knowledgeBase.crops.maize;
          return `For ${crop} in ${location}:
• Apply ${cropData.fertilizer}
• Consider soil test results for exact rates
• Apply when soil is moist
• Incorporate fertilizer into soil for best results`;
        },
        
        watering: (crop, weather) => {
          const cropData = this.knowledgeBase.crops[crop] || this.knowledgeBase.crops.maize;
          return `Watering recommendations for ${crop}:
• Critical periods: ${cropData.water}
• Current weather: ${weather || 'check local forecast'}
• Use drip irrigation if available for water efficiency
• Water early morning to reduce evaporation`;
        },
        
        pest: (crop, pest) => {
          const cropData = this.knowledgeBase.crops[crop] || this.knowledgeBase.crops.maize;
          return `Pest management for ${crop}:
• Common pests: ${cropData.pests.join(', ')}
• Monitor fields weekly
• Use integrated pest management (IPM)
• Contact extension officer for specific pesticides`;
        }
      }
    };
  }

  // Main method to get AI response
  async getResponse(question, context, language = 'en') {
    try {
      // Check if we can enhance context with planting guide data
      let enhancedContext = { ...context };
      
      if (context && context.crop) {
        // Get crop-specific knowledge
        const cropData = this.knowledgeBase.crops[context.crop] || this.knowledgeBase.crops.maize;
        enhancedContext.cropData = cropData;
      }

      // Try to get weather data if available
      let weatherData = null;
      if (this.agrometUrl) {
        try {
          const { data } = await axios.get(`${this.agrometUrl}/current`, { timeout: 3000 });
          weatherData = data;
        } catch (err) {
          console.log('Agromet service not available, using default');
        }
      }

      // Generate response based on question type
      const response = await this.generateResponse(question, enhancedContext, weatherData, language);
      
      return {
        answer: response.answer,
        sources: response.sources || ['Mosupisi Agricultural Knowledge Base'],
        contextUsed: enhancedContext
      };

    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }

  // Generate response based on question analysis
  async generateResponse(question, context, weather, language) {
    const question_lower = question.toLowerCase();
    
    // Determine question type
    if (question_lower.includes('fertilizer') || question_lower.includes('fertilize')) {
      return this.handleFertilizerQuestion(question, context, weather, language);
    } else if (question_lower.includes('water') || question_lower.includes('irrigation') || question_lower.includes('rain')) {
      return this.handleWaterQuestion(question, context, weather, language);
    } else if (question_lower.includes('pest') || question_lower.includes('disease') || question_lower.includes('insect')) {
      return this.handlePestQuestion(question, context, weather, language);
    } else if (question_lower.includes('plant') || question_lower.includes('when to')) {
      return this.handlePlantingQuestion(question, context, weather, language);
    } else if (question_lower.includes('harvest') || question_lower.includes('when is it ready')) {
      return this.handleHarvestQuestion(question, context, weather, language);
    } else {
      return this.handleGeneralQuestion(question, context, weather, language);
    }
  }

  handleFertilizerQuestion(question, context, weather, language) {
    const crop = context?.crop || 'maize';
    const location = context?.location || 'your field';
    const cropData = this.knowledgeBase.crops[crop] || this.knowledgeBase.crops.maize;
    
    let answer = '';
    
    if (language === 'st') {
      // Sesotho response
      answer = `Ho tsoa potsong ea hau ka manyolo bakeng sa ${crop} ${location}:

Tataiso ea Manyolo:
• Sebelisa ${cropData.fertilizer}
• Ha u se u sebelisitse manyolo a motheo, u ka kenya LAN ka mor'a libeke tse 4-6
• Ho bohlokoa ho etsa tlhahlobo ea mobu pele u sebelisa manyolo
• Sebelisa manyolo ha mobu o mongobo

Nako e nepahetseng:
• Manyolo a motheo: nakong ea ho jala
• Top-dressing: libeke tse 4-6 ka mor'a ho mela

Hlokomela: Sebelisa manyolo a mangata ho latela boemo ba mobu oa hau.`;
    } else {
      // English response
      answer = `Regarding your question about fertilizing ${crop} at ${location}:

Fertilizer Recommendations:
• Apply ${cropData.fertilizer}
• If you already applied basal fertilizer, top-dress with LAN at 4-6 weeks after emergence
• Consider soil testing for precise recommendations
• Apply when soil is moist for better uptake

Timing:
• Basal fertilizer: At planting time
• Top-dressing: 4-6 weeks after emergence

Note: Adjust rates based on your specific soil conditions and crop stage.`;
    }

    return {
      answer,
      sources: ['Fertilizer Recommendations 2026', 'Department of Agricultural Research']
    };
  }

  handleWaterQuestion(question, context, weather, language) {
    const crop = context?.crop || 'maize';
    const cropData = this.knowledgeBase.crops[crop] || this.knowledgeBase.crops.maize;
    
    let answer = '';
    
    if (language === 'st') {
      answer = `Tataiso ea ho nosetsa ${crop}:

Nako ea Bohlokoa ea Metsi:
• ${cropData.water}

Maemo a Hona Joale a Leholimo:
• ${weather ? 'Pula e lebeletsoe' : 'Hlahloba boemo ba leholimo ba sebaka sa heno'}

Keletso:
• Nosetsa hoseng ho qoba mouoane
• Sebelisa mulch ho boloka mongobo
• Lekola mongobo oa mobu pele u nosetsa`;
    } else {
      answer = `Watering guide for ${crop}:

Critical Watering Periods:
• ${cropData.water}

Current Weather Context:
• ${weather ? 'Rainfall expected in the coming days' : 'Check your local weather forecast'}

Recommendations:
• Water early morning to reduce evaporation
• Use mulch to retain soil moisture
• Check soil moisture before watering - insert finger 5cm into soil
• If moist, delay watering; if dry, water thoroughly`;
    }

    return {
      answer,
      sources: ['Irrigation Guidelines', 'Lesotho Meteorological Services']
    };
  }

  handlePestQuestion(question, context, weather, language) {
    const crop = context?.crop || 'maize';
    const cropData = this.knowledgeBase.crops[crop] || this.knowledgeBase.crops.maize;
    
    let answer = '';
    
    if (language === 'st') {
      answer = `Taolo ea Likokoanyana bakeng sa ${crop}:

Likokoanyana Tse Tloaelehileng:
• ${cropData.pests.join('\n• ')}

Mokhoa oa Taolo:
• Hlahloba masimo beke le beke
• Sebelisa mekhoa e kopaneng (IPM)
• Tseba ho lemoha matšoao a likokoanyana kapele

Thuso:
• Ikopanye le ofisiri ea temo sebakeng sa heno bakeng sa likhothaletso tse tobileng`;
    } else {
      answer = `Pest Management for ${crop}:

Common Pests in Lesotho:
• ${cropData.pests.join('\n• ')}

Management Approach:
• Scout fields weekly for early detection
• Use integrated pest management (IPM)
• Learn to identify pest damage early
• Consider beneficial insects that control pests

For specific pesticide recommendations:
• Contact your local agricultural extension officer
• Follow label instructions carefully
• Consider organic options first`;
    }

    return {
      answer,
      sources: ['Plant Protection Service', 'IPM Guidelines']
    };
  }

  handlePlantingQuestion(question, context, weather, language) {
    const crop = context?.crop || 'maize';
    const cropData = this.knowledgeBase.crops[crop] || this.knowledgeBase.crops.maize;
    
    let answer = '';
    
    if (language === 'st') {
      answer = `Tataiso ea ho Jala ${crop}:

Nako ea ho Jala: ${cropData.planting}
Sebaka pakeng tsa mela: ${cropData.spacing}
Mefuta e Khothaletsoang: ${cropData.varieties.join(', ')}

Tlhatlhamano ea lijalo:
• Kamora ${crop}, jala legumes ho khutlisa naetrojene
• Etsa tlhahlobo ea mobu pele u jala
• Lokisa mobu ka manyolo a manyolo`;
    } else {
      answer = `Planting Guide for ${crop}:

Planting Window: ${cropData.planting}
Spacing: ${cropData.spacing}
Recommended Varieties: ${cropData.varieties.join(', ')}

Crop Rotation:
• After ${crop}, plant legumes to restore nitrogen
• Avoid planting maize after maize to prevent pest buildup

Preparation:
• Test soil before planting
• Incorporate compost or manure 2-3 weeks before planting
• Ensure good seedbed preparation for optimal germination`;
    }

    return {
      answer,
      sources: ['Planting Guide 2026', 'Seed Catalog']
    };
  }

  handleHarvestQuestion(question, context, weather, language) {
    const crop = context?.crop || 'maize';
    
    let answer = '';
    
    if (language === 'st') {
      answer = `Ho khetholla nako ea kotulo bakeng sa ${crop}:

Matšoao a hore sejalo se butsoitse:
• Maize: Lithollo li thata, makhasi a omme
• Sorghum: Lithollo li thata, 'mala o lefifi
• Legumes: Likhapetla li omme, li ka petsoha habonolo

Tlhahlobo ea boemo:
• Sheba matsatsi a ho jala (ka mor'a matsatsi a 120-150)
• Hlahloba mongobo oa lithollo
• Sheba boemo ba leholimo - khotla pele ha pula e kholo

Kamora kotulo:
• Omise lithollo hantle
• Boloka sebakeng se omileng, se pholileng`;
    } else {
      answer = `Determining harvest time for ${crop}:

Signs of Maturity:
• Maize: Kernels hard, black layer formed, husks dry
• Sorghum: Seeds hard, color darkens
• Legumes: Pods dry, easily split open

Timing Check:
• Count days from planting (usually 120-150 days depending on variety)
• Test grain moisture (should be 12-15% for storage)
• Check weather forecast - harvest before heavy rains

Post-Harvest:
• Dry grains properly on clean surfaces
• Store in cool, dry place
• Treat for storage pests if needed`;
    }

    return {
      answer,
      sources: ['Post-Harvest Handbook', 'Grain Storage Guidelines']
    };
  }

  handleGeneralQuestion(question, context, weather, language) {
    const crop = context?.crop || 'crops';
    const location = context?.location || 'your area';
    
    let answer = '';
    
    if (language === 'st') {
      answer = `Ke leboha potso ea hau ka ${crop} ${location}.

Ho fana ka keletso e nepahetseng, ke hloka tlhahisoleseling e eketsehileng:
• Sejalo ke sefe hantle? (poone, mabele, linaoa)
• Selemong sena se lemiloe neng?
• Na u bone mathata afe? (likokoanyana, mafu, komello)

Ka kopo, botsa potso e tobileng haholoanyane, 'me ke tla thusa ka botlalo.`;
    } else {
      answer = `Thank you for your question about ${crop} in ${location}.

To give you the most accurate advice for your situation in Lesotho, I'd like to know:
• Which specific crop are you asking about? (maize, sorghum, legumes)
• When was it planted this season?
• What specific issues are you observing? (pests, diseases, drought)

Please provide more details, and I'll give you tailored advice for your farm.`;
    }

    return {
      answer,
      sources: ['General Agricultural Guidelines']
    };
  }
}

module.exports = new AIService();