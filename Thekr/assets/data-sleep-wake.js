/* أذكار النوم والاستيقاظ — Sleep & Waking remembrances
   Arabic text follows حصن المسلم (سعيد بن علي القحطاني).
   ref = takhrīj (book + hadith number) · grade = درجة الحديث */
window.THEKR_DATA = {
  id: 'sleep-wake',

  strings: {
    virtue: 'الفضل:',
    remaining: 'بقي {n} — انقر للعدّ',
    completed: 'تمّ هذا الذكر',
    undo: 'تراجع عن آخر عدّة',
    markDone: 'تعليم كمكتمل',
    fontSize: 'حجم الخط',
    smaller: 'تصغير الخط',
    larger: 'تكبير الخط',
    tashkeel: 'التشكيل',
    tashkeelHint: 'إظهار الحركات على الحروف',
    translit: 'النطق بالحروف اللاتينية',
    translitHint: 'يفيد من لا يقرأ العربية',
    translation: 'الترجمة الإنجليزية',
    translationHint: 'معنى الذكر بالإنجليزية',
    awake: 'إبقاء الشاشة مضاءة',
    awakeHint: 'لا تنطفئ الشاشة أثناء الذكر',
    theme: 'المظهر',
    themeAuto: 'تلقائي',
    themeDay: 'نهاري',
    themeNight: 'ليلي',
    reset: 'إعادة التعيين',
    resetHint: 'يُعاد العدّ تلقائياً كل يوم',
    resetBtn: 'تصفير العدّاد',
    resetDone: 'تم تصفير العدّاد',
    newDay: 'يوم جديد — أُعيد ضبط العدّاد'
  },

  sets: [
    { id: 'wake',  label: 'أذكار الاستيقاظ', theme: 'day',   icon: 'sunrise' },
    { id: 'sleep', label: 'أذكار النوم',     theme: 'night', icon: 'bed' }
  ],

  items: [
    /* ------------------------- الاستيقاظ ------------------------- */
    {
      id: 1, sets: ['wake'], count: 1,
      ar: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ.',
      tr: 'Al-ḥamdu lillāhi-lladhī aḥyānā baʿda mā amātanā wa-ilayhi-n-nushūr.',
      en: 'All praise is for Allah, who gave us life after He caused us to die, and to Him is the resurrection.',
      ref: 'متفق عليه · البخاري ٦٣١٢، ومسلم ٢٧١١',
      grade: 'متفق عليه', gradeKey: 'agreed',
      note: 'يُقال فور الاستيقاظ.'
    },
    {
      id: 2, sets: ['wake'], count: 1,
      ar: 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، الْحَمْدُ لِلَّهِ، وَسُبْحَانَ اللَّهِ، وَلاَ إِلَهَ إِلاَّ اللَّهُ، وَاللَّهُ أَكْبَرُ، وَلاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ. اللَّهُمَّ اغْفِرْ لِي.',
      tr: 'Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa-lahu-l-ḥamd, wa-huwa ʿalā kulli shayʾin qadīr. Al-ḥamdu lillāh, wa-subḥāna-llāh, wa-lā ilāha illa-llāh, wa-llāhu akbar, wa-lā ḥawla wa-lā quwwata illā billāh. Allāhumma-ghfir lī.',
      en: 'There is no god but Allah alone, without partner; His is the dominion and His is the praise, and He has power over everything. Praise be to Allah, glory be to Allah, there is no god but Allah, Allah is the Greatest, and there is no might nor power except with Allah. O Allah, forgive me.',
      ref: 'رواه البخاري ١١٥٤',
      grade: 'صحيح', gradeKey: 'sahih',
      note: 'يقولها من استيقظ من الليل. وجاءت بلفظ «رَبِّ اغْفِرْ لِي» عند أبي داود ٥٠٦٠.',
      virtue: 'من قالها عند الاستيقاظ من الليل غُفِر له، فإن دعا استُجيب له، فإن قام فتوضأ وصلّى قُبِلت صلاته.'
    },
    {
      id: 3, sets: ['wake'], count: 1,
      ar: 'الْحَمْدُ لِلَّهِ الَّذِي عَافَانِي فِي جَسَدِي، وَرَدَّ عَلَيَّ رُوحِي، وَأَذِنَ لِي بِذِكْرِهِ.',
      tr: 'Al-ḥamdu lillāhi-lladhī ʿāfānī fī jasadī, wa-radda ʿalayya rūḥī, wa-adhina lī bi-dhikrih.',
      en: 'All praise is for Allah, who restored my body to health, returned my soul to me, and permitted me to remember Him.',
      ref: 'الترمذي ٣٤٠١؛ حسنه الألباني في صحيح الترمذي ٣/١٤٤',
      grade: 'حسن', gradeKey: 'hasan'
    },
    {
      id: 4, sets: ['wake'], count: 1,
      ar: 'قِرَاءَةُ الْآيَاتِ الْعَشْرِ الْأَوَاخِرِ مِنْ سُورَةِ آلِ عِمْرَانَ ﴿إِنَّ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ وَاخْتِلَافِ اللَّيْلِ وَالنَّهَارِ لَآيَاتٍ لِأُولِي الْأَلْبَابِ﴾ إِلَى آخِرِ السُّورَةِ.',
      en: 'Recite the last ten verses of Sūrat Āl ʿImrān (3:190–200), beginning: “Indeed, in the creation of the heavens and the earth and the alternation of night and day are signs for people of understanding.”',
      ref: 'سورة آل عمران: ١٩٠–٢٠٠ · متفق عليه · البخاري ٤٥٦٩، ومسلم ٢٥٦',
      grade: 'قرآن', gradeKey: 'quran',
      virtue: 'كان النبي ﷺ إذا استيقظ من الليل قرأها ثم تسوّك وتوضأ.'
    },

    /* --------------------------- النوم --------------------------- */
    {
      id: 5, sets: ['sleep'], count: 3,
      ar: 'يَجْمَعُ كَفَّيْهِ ثُمَّ يَنْفُثُ فِيهِمَا فَيَقْرَأُ فِيهِمَا: ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ وَ﴿قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ﴾ وَ﴿قُلْ أَعُوذُ بِرَبِّ النَّاسِ﴾، ثُمَّ يَمْسَحُ بِهِمَا مَا اسْتَطَاعَ مِنْ جَسَدِهِ، يَبْدَأُ بِهِمَا عَلَى رَأْسِهِ وَوَجْهِهِ وَمَا أَقْبَلَ مِنْ جَسَدِهِ.',
      en: 'Cup your hands together, breathe into them and recite Sūrat al-Ikhlāṣ, al-Falaq and an-Nās; then wipe your hands over as much of your body as you can, beginning with your head, your face and the front of your body. Do this three times.',
      ref: 'متفق عليه · البخاري ٥٠١٧، ومسلم ٢١٩٢',
      grade: 'متفق عليه', gradeKey: 'agreed',
      note: 'يُفعل ثلاث مرات.'
    },
    {
      id: 6, sets: ['sleep'], count: 1,
      ar: 'آيَةُ الْكُرْسِيِّ ﴿اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ...﴾ إِلَى آخِرِ الْآيَةِ.',
      en: 'Recite Āyat al-Kursī (Qur’an 2:255): “Allah — there is no god but He, the Ever-Living, the Sustainer of all…” to the end of the verse.',
      ref: 'سورة البقرة: ٢٥٥ · رواه البخاري ٢٣١١',
      grade: 'قرآن', gradeKey: 'quran',
      virtue: 'من قرأها إذا أوى إلى فراشه لم يزل عليه من الله حافظ، ولا يقربه شيطان حتى يصبح.'
    },
    {
      id: 7, sets: ['sleep'], count: 1,
      ar: 'الْآيَتَانِ الْأَخِيرَتَانِ مِنْ سُورَةِ الْبَقَرَةِ ﴿آمَنَ الرَّسُولُ بِمَا أُنْزِلَ إِلَيْهِ مِنْ رَبِّهِ وَالْمُؤْمِنُونَ...﴾ إِلَى آخِرِ السُّورَةِ.',
      en: 'Recite the last two verses of Sūrat al-Baqarah (2:285–286): “The Messenger has believed in what was revealed to him from his Lord, and so have the believers…” to the end of the sūrah.',
      ref: 'سورة البقرة: ٢٨٥–٢٨٦ · متفق عليه · البخاري ٥٠٠٩، ومسلم ٨٠٨',
      grade: 'قرآن', gradeKey: 'quran',
      virtue: 'من قرأهما في ليلة كفتاه.'
    },
    {
      id: 8, sets: ['sleep'], count: 1,
      ar: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.',
      tr: 'Bismika rabbī waḍaʿtu janbī, wa-bika arfaʿuh, fa-in amsakta nafsī fa-rḥamhā, wa-in arsaltahā fa-ḥfaẓhā bi-mā taḥfaẓu bihi ʿibādaka-ṣ-ṣāliḥīn.',
      en: 'In Your name, my Lord, I lay down my side, and by You I raise it. If You take my soul, have mercy on it; and if You release it, protect it with that by which You protect Your righteous servants.',
      ref: 'متفق عليه · البخاري ٦٣٢٠، ومسلم ٢٧١٤',
      grade: 'متفق عليه', gradeKey: 'agreed'
    },
    {
      id: 9, sets: ['sleep'], count: 1,
      ar: 'اللَّهُمَّ إِنَّكَ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا، لَكَ مَمَاتُهَا وَمَحْيَاهَا، إِنْ أَحْيَيْتَهَا فَاحْفَظْهَا، وَإِنْ أَمَتَّهَا فَاغْفِرْ لَهَا. اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ.',
      tr: 'Allāhumma innaka khalaqta nafsī wa-anta tawaffāhā, laka mamātuhā wa-maḥyāhā. In aḥyaytahā fa-ḥfaẓhā, wa-in amattahā fa-ghfir lahā. Allāhumma innī asʾaluka-l-ʿāfiyah.',
      en: 'O Allah, You created my soul and You take it back; to You belongs its death and its life. If You keep it alive, protect it; and if You take it, forgive it. O Allah, I ask You for well-being.',
      ref: 'رواه مسلم ٢٧١٢',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 10, sets: ['sleep'], count: 3,
      ar: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ.',
      tr: 'Allāhumma qinī ʿadhābaka yawma tabʿathu ʿibādak.',
      en: 'O Allah, shield me from Your punishment on the Day You resurrect Your servants.',
      ref: 'أبو داود ٥٠٤٥، والترمذي ٣٣٩٨؛ صححه الألباني في صحيح الترمذي ٣/١٤٣',
      grade: 'صحيح', gradeKey: 'sahih',
      note: 'يقولها ثلاث مرات حين يضع يده اليمنى تحت خدّه.'
    },
    {
      id: 11, sets: ['sleep'], count: 1,
      ar: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.',
      tr: 'Bismika-llāhumma amūtu wa-aḥyā.',
      en: 'In Your name, O Allah, I die and I live.',
      ref: 'رواه البخاري ٦٣٢٤',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 12, sets: ['sleep'], count: 33,
      ar: 'سُبْحَانَ اللَّهِ.',
      tr: 'Subḥāna-llāh.',
      en: 'Glory be to Allah.',
      ref: 'متفق عليه · البخاري ٥٣٦٢، ومسلم ٢٧٢٧',
      grade: 'متفق عليه', gradeKey: 'agreed',
      virtue: 'تسبيح فاطمة رضي الله عنها عند النوم — قال ﷺ لها ولعليّ: «هو خير لكما من خادم».'
    },
    {
      id: 13, sets: ['sleep'], count: 33,
      ar: 'الْحَمْدُ لِلَّهِ.',
      tr: 'Al-ḥamdu lillāh.',
      en: 'All praise is for Allah.',
      ref: 'متفق عليه · البخاري ٥٣٦٢، ومسلم ٢٧٢٧',
      grade: 'متفق عليه', gradeKey: 'agreed'
    },
    {
      id: 14, sets: ['sleep'], count: 34,
      ar: 'اللَّهُ أَكْبَرُ.',
      tr: 'Allāhu akbar.',
      en: 'Allah is the Greatest.',
      ref: 'متفق عليه · البخاري ٥٣٦٢، ومسلم ٢٧٢٧',
      grade: 'متفق عليه', gradeKey: 'agreed'
    },
    {
      id: 15, sets: ['sleep'], count: 1,
      ar: 'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لاَ مَلْجَأَ وَلاَ مَنْجَا مِنْكَ إِلاَّ إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ.',
      tr: 'Allāhumma aslamtu nafsī ilayk, wa-fawwaḍtu amrī ilayk, wa-wajjahtu wajhī ilayk, wa-aljaʾtu ẓahrī ilayk, raghbatan wa-rahbatan ilayk. Lā maljaʾa wa-lā manjā minka illā ilayk. Āmantu bi-kitābika-lladhī anzalt, wa-bi-nabiyyika-lladhī arsalt.',
      en: 'O Allah, I submit myself to You, entrust my affair to You, turn my face to You, and lean my back upon You — in hope of You and in fear of You. There is no refuge and no escape from You except to You. I believe in Your Book which You revealed, and in Your Prophet whom You sent.',
      ref: 'متفق عليه · البخاري ٦٣١٣، ومسلم ٢٧١٠',
      grade: 'متفق عليه', gradeKey: 'agreed',
      virtue: 'من قالها ومات من ليلته مات على الفطرة. ويُستحب أن تكون آخر ما يقول قبل النوم.'
    },
    {
      id: 16, sets: ['sleep'], count: 1,
      ar: 'اللَّهُمَّ رَبَّ السَّمَوَاتِ السَّبْعِ وَرَبَّ الْعَرْشِ الْعَظِيمِ، رَبَّنَا وَرَبَّ كُلِّ شَيْءٍ، فَالِقَ الْحَبِّ وَالنَّوَى، وَمُنْزِلَ التَّوْرَاةِ وَالْإِنْجِيلِ وَالْفُرْقَانِ، أَعُوذُ بِكَ مِنْ شَرِّ كُلِّ شَيْءٍ أَنْتَ آخِذٌ بِنَاصِيَتِهِ. اللَّهُمَّ أَنْتَ الْأَوَّلُ فَلَيْسَ قَبْلَكَ شَيْءٌ، وَأَنْتَ الْآخِرُ فَلَيْسَ بَعْدَكَ شَيْءٌ، وَأَنْتَ الظَّاهِرُ فَلَيْسَ فَوْقَكَ شَيْءٌ، وَأَنْتَ الْبَاطِنُ فَلَيْسَ دُونَكَ شَيْءٌ، اقْضِ عَنَّا الدَّيْنَ وَأَغْنِنَا مِنَ الْفَقْرِ.',
      tr: 'Allāhumma rabba-s-samāwāti-s-sabʿi wa-rabba-l-ʿarshi-l-ʿaẓīm, rabbanā wa-rabba kulli shayʾ, fāliqa-l-ḥabbi wa-n-nawā, wa-munzila-t-tawrāti wa-l-injīli wa-l-furqān, aʿūdhu bika min sharri kulli shayʾin anta ākhidhun bi-nāṣiyatih. Allāhumma anta-l-awwalu fa-laysa qablaka shayʾ, wa-anta-l-ākhiru fa-laysa baʿdaka shayʾ, wa-anta-ẓ-ẓāhiru fa-laysa fawqaka shayʾ, wa-anta-l-bāṭinu fa-laysa dūnaka shayʾ. Iqḍi ʿanna-d-dayna wa-aghninā mina-l-faqr.',
      en: 'O Allah, Lord of the seven heavens and Lord of the Mighty Throne, our Lord and Lord of all things, Splitter of the grain and the date-stone, Revealer of the Torah, the Gospel and the Criterion — I seek refuge in You from the evil of every thing whose forelock You hold. O Allah, You are the First: nothing is before You. You are the Last: nothing is after You. You are the Manifest: nothing is above You. You are the Hidden: nothing is beyond You. Settle our debt for us and free us from poverty.',
      ref: 'رواه مسلم ٢٧١٣',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 17, sets: ['sleep'], count: 1,
      ar: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا، وَكَفَانَا وَآوَانَا، فَكَمْ مِمَّنْ لاَ كَافِيَ لَهُ وَلاَ مُؤْوِيَ.',
      tr: 'Al-ḥamdu lillāhi-lladhī aṭʿamanā wa-saqānā, wa-kafānā wa-āwānā, fa-kam mimman lā kāfiya lahu wa-lā muʾwī.',
      en: 'All praise is for Allah, who fed us and gave us drink, who sufficed us and gave us shelter — for how many there are who have none to suffice them and none to shelter them.',
      ref: 'رواه مسلم ٢٧١٥',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 18, sets: ['sleep'], count: 1,
      ar: 'قِرَاءَةُ سُورَةِ الْمُلْكِ ﴿تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ﴾.',
      en: 'Recite Sūrat al-Mulk (Qur’an 67): “Blessed is He in whose hand is dominion, and He is over all things competent.”',
      ref: 'الترمذي ٢٨٩١، والنسائي في الكبرى ١٠٥٤٦؛ حسنه الألباني في صحيح الترمذي ٢/٧',
      grade: 'حسن', gradeKey: 'hasan',
      virtue: 'سورة تشفع لصاحبها حتى يُغفر له، وكان النبي ﷺ لا ينام حتى يقرأ الم تنزيل وتبارك.'
    },
    {
      id: 19, sets: ['sleep'], count: 1,
      ar: 'إِذَا تَقَلَّبَ فِي فِرَاشِهِ لَيْلاً: لاَ إِلَهَ إِلاَّ اللَّهُ الْوَاحِدُ الْقَهَّارُ، رَبُّ السَّمَوَاتِ وَالْأَرْضِ وَمَا بَيْنَهُمَا الْعَزِيزُ الْغَفَّارُ.',
      tr: 'Lā ilāha illa-llāhu-l-wāḥidu-l-qahhār, rabbu-s-samāwāti wa-l-arḍi wa-mā baynahuma-l-ʿazīzu-l-ghaffār.',
      en: 'There is no god but Allah, the One, the All-Subduing, Lord of the heavens and the earth and all that is between them, the Almighty, the Ever-Forgiving. — Said when turning over in bed during the night.',
      ref: 'الحاكم ١/٥٤٠، والنسائي في عمل اليوم والليلة ٨٦٤؛ صححه الألباني في صحيح الجامع ٤٦٩٣',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 20, sets: ['sleep'], count: 1,
      ar: 'عِنْدَ الْفَزَعِ فِي النَّوْمِ أَوْ رُؤْيَةِ مَا يُكْرَهُ: أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ غَضَبِهِ وَعِقَابِهِ، وَشَرِّ عِبَادِهِ، وَمِنْ هَمَزَاتِ الشَّيَاطِينِ وَأَنْ يَحْضُرُونِ.',
      tr: 'Aʿūdhu bi-kalimāti-llāhi-t-tāmmāti min ghaḍabihi wa-ʿiqābih, wa-sharri ʿibādih, wa-min hamazāti-sh-shayāṭīni wa-an yaḥḍurūn.',
      en: 'I seek refuge in the perfect words of Allah from His anger and His punishment, from the evil of His servants, and from the promptings of the devils and from their presence. — Said on waking in fright or after a distressing dream.',
      ref: 'أبو داود ٣٨٩٣، والترمذي ٣٥٢٨؛ حسنه الألباني في صحيح الترمذي ٣/١٧١',
      grade: 'حسن', gradeKey: 'hasan'
    }
  ]
};
