/* أذكار الصباح والمساء — Morning & Evening remembrances
   Arabic text follows حصن المسلم (سعيد بن علي القحطاني).
   ref = takhrīj (book + hadith number) · grade = درجة الحديث */
window.THEKR_DATA = {
  id: 'morning-evening',

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
    { id: 'morning', label: 'أذكار الصباح', theme: 'day',   icon: 'sun'  },
    { id: 'evening', label: 'أذكار المساء', theme: 'night', icon: 'moon' }
  ],

  items: [
    {
      id: 1, sets: ['morning', 'evening'], count: 1,
      ar: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ ﴿اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاءَ وَسِعَ كُرْسِيُّهُ السَّمَوَاتِ وَالْأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ﴾',
      tr: 'Aʿūdhu billāhi mina-sh-shayṭāni-r-rajīm. Allāhu lā ilāha illā huwa-l-ḥayyu-l-qayyūm. Lā taʾkhudhuhu sinatun wa-lā nawm. Lahu mā fi-s-samāwāti wa-mā fi-l-arḍ. Man dha-lladhī yashfaʿu ʿindahu illā bi-idhnih. Yaʿlamu mā bayna aydīhim wa-mā khalfahum, wa-lā yuḥīṭūna bi-shayʾin min ʿilmihi illā bi-mā shāʾ. Wasiʿa kursiyyuhu-s-samāwāti wa-l-arḍ, wa-lā yaʾūduhu ḥifẓuhumā, wa-huwa-l-ʿaliyyu-l-ʿaẓīm.',
      en: 'I seek refuge in Allah from Satan, the accursed. Allah — there is no god but He, the Ever-Living, the Sustainer of all. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who can intercede with Him except by His permission? He knows what lies before them and what lies behind them, and they encompass nothing of His knowledge except what He wills. His Kursī embraces the heavens and the earth, and their preservation does not weary Him. He is the Most High, the Most Great.',
      ref: 'سورة البقرة: ٢٥٥ · الحاكم ١/٥٦٢، وصححه الألباني في صحيح الترغيب ١/٢٧٣',
      grade: 'قرآن', gradeKey: 'quran',
      virtue: 'من قالها حين يصبح أُجير من الجن حتى يمسي، ومن قالها حين يمسي أُجير من الجن حتى يصبح.'
    },
    {
      id: 2, sets: ['morning', 'evening'], count: 3,
      ar: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ هُوَ اللَّهُ أَحَدٌ * اللَّهُ الصَّمَدُ * لَمْ يَلِدْ وَلَمْ يُولَدْ * وَلَمْ يَكُن لَّهُ كُفُواً أَحَدٌ﴾ بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ * مِن شَرِّ مَا خَلَقَ * وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ * وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ * وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ﴾ بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ أَعُوذُ بِرَبِّ النَّاسِ * مَلِكِ النَّاسِ * إِلَهِ النَّاسِ * مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ * الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ * مِنَ الْجِنَّةِ وَالنَّاسِ﴾',
      tr: 'Qul huwa-llāhu aḥad. Allāhu-ṣ-ṣamad. Lam yalid wa-lam yūlad. Wa-lam yakun lahu kufuwan aḥad. — Qul aʿūdhu bi-rabbi-l-falaq. Min sharri mā khalaq. Wa-min sharri ghāsiqin idhā waqab. Wa-min sharri-n-naffāthāti fi-l-ʿuqad. Wa-min sharri ḥāsidin idhā ḥasad. — Qul aʿūdhu bi-rabbi-n-nās. Maliki-n-nās. Ilāhi-n-nās. Min sharri-l-waswāsi-l-khannās. Alladhī yuwaswisu fī ṣudūri-n-nās. Mina-l-jinnati wa-n-nās.',
      en: 'Say: He is Allah, the One. Allah, the Eternal Refuge. He neither begets nor is born, and there is none comparable to Him. — Say: I seek refuge in the Lord of daybreak, from the evil of what He created, from the evil of darkness when it settles, from the evil of those who blow on knots, and from the evil of an envier when he envies. — Say: I seek refuge in the Lord of mankind, the Sovereign of mankind, the God of mankind, from the evil of the retreating whisperer who whispers in the breasts of mankind, from among jinn and men.',
      ref: 'سور الإخلاص والفلق والناس · أبو داود ٥٠٨٢، والترمذي ٣٥٧٥؛ حسنه الألباني في صحيح الترمذي ٣/١٨٢',
      grade: 'قرآن', gradeKey: 'quran',
      virtue: 'من قالها ثلاث مرات حين يصبح وحين يمسي كفته من كل شيء.'
    },
    {
      id: 3, sets: ['morning'], count: 1,
      ar: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ. رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.',
      tr: 'Aṣbaḥnā wa-aṣbaḥa-l-mulku lillāh, wa-l-ḥamdu lillāh, lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa-lahu-l-ḥamdu wa-huwa ʿalā kulli shayʾin qadīr. Rabbi asʾaluka khayra mā fī hādha-l-yawmi wa-khayra mā baʿdah, wa-aʿūdhu bika min sharri mā fī hādha-l-yawmi wa-sharri mā baʿdah. Rabbi aʿūdhu bika mina-l-kasali wa-sūʾi-l-kibar. Rabbi aʿūdhu bika min ʿadhābin fi-n-nāri wa-ʿadhābin fi-l-qabr.',
      en: 'We have entered the morning and the dominion belongs to Allah; all praise is for Allah. There is no god but Allah alone, without partner; His is the dominion and His is the praise, and He has power over everything. My Lord, I ask You for the good of this day and the good that follows it, and I seek refuge in You from the evil of this day and the evil that follows it. My Lord, I seek refuge in You from laziness and the misery of old age. My Lord, I seek refuge in You from punishment in the Fire and punishment in the grave.',
      ref: 'رواه مسلم ٢٧٢٣',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 4, sets: ['evening'], count: 1,
      ar: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا. رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.',
      tr: 'Amsaynā wa-amsa-l-mulku lillāh, wa-l-ḥamdu lillāh, lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa-lahu-l-ḥamdu wa-huwa ʿalā kulli shayʾin qadīr. Rabbi asʾaluka khayra mā fī hādhihi-l-laylati wa-khayra mā baʿdahā, wa-aʿūdhu bika min sharri mā fī hādhihi-l-laylati wa-sharri mā baʿdahā. Rabbi aʿūdhu bika mina-l-kasali wa-sūʾi-l-kibar. Rabbi aʿūdhu bika min ʿadhābin fi-n-nāri wa-ʿadhābin fi-l-qabr.',
      en: 'We have entered the evening and the dominion belongs to Allah; all praise is for Allah. There is no god but Allah alone, without partner; His is the dominion and His is the praise, and He has power over everything. My Lord, I ask You for the good of this night and the good that follows it, and I seek refuge in You from the evil of this night and the evil that follows it. My Lord, I seek refuge in You from laziness and the misery of old age. My Lord, I seek refuge in You from punishment in the Fire and punishment in the grave.',
      ref: 'رواه مسلم ٢٧٢٣',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 5, sets: ['morning'], count: 1,
      ar: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.',
      tr: 'Allāhumma bika aṣbaḥnā, wa-bika amsaynā, wa-bika naḥyā, wa-bika namūt, wa-ilayka-n-nushūr.',
      en: 'O Allah, by You we enter the morning and by You we enter the evening; by You we live and by You we die, and to You is the resurrection.',
      ref: 'رواه الترمذي ٣٣٩١، وأبو داود ٥٠٦٨؛ صححه الألباني في صحيح الترمذي ٣/١٤٢',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 6, sets: ['evening'], count: 1,
      ar: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ.',
      tr: 'Allāhumma bika amsaynā, wa-bika aṣbaḥnā, wa-bika naḥyā, wa-bika namūt, wa-ilayka-l-maṣīr.',
      en: 'O Allah, by You we enter the evening and by You we enter the morning; by You we live and by You we die, and to You is the final return.',
      ref: 'رواه الترمذي ٣٣٩١، وأبو داود ٥٠٦٨؛ صححه الألباني في صحيح الترمذي ٣/١٤٢',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 7, sets: ['morning', 'evening'], count: 1,
      ar: 'اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ.',
      tr: 'Allāhumma anta rabbī lā ilāha illā ant, khalaqtanī wa-anā ʿabduk, wa-anā ʿalā ʿahdika wa-waʿdika ma-staṭaʿt. Aʿūdhu bika min sharri mā ṣanaʿt. Abūʾu laka bi-niʿmatika ʿalayy, wa-abūʾu bi-dhanbī fa-ghfir lī, fa-innahu lā yaghfiru-dh-dhunūba illā ant.',
      en: 'O Allah, You are my Lord; there is no god but You. You created me and I am Your servant, and I hold to Your covenant and promise as best I can. I seek refuge in You from the evil I have done. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me — for none forgives sins but You.',
      ref: 'سيد الاستغفار · رواه البخاري ٦٣٠٦',
      grade: 'صحيح', gradeKey: 'sahih',
      virtue: 'من قالها موقناً بها حين يمسي فمات من ليلته دخل الجنة، وكذلك إذا أصبح.'
    },
    {
      id: 8, sets: ['morning'], count: 4,
      ar: 'اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لاَ إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ.',
      tr: 'Allāhumma innī aṣbaḥtu ush-hiduk, wa-ush-hidu ḥamalata ʿarshik, wa-malāʾikatak, wa-jamīʿa khalqik, annaka anta-llāhu lā ilāha illā anta waḥdaka lā sharīka lak, wa-anna Muḥammadan ʿabduka wa-rasūluk.',
      en: 'O Allah, I have entered the morning calling You to witness, and calling to witness the bearers of Your Throne, Your angels and all Your creation, that You are Allah — there is no god but You alone, without partner — and that Muhammad is Your servant and Messenger.',
      ref: 'أبو داود ٥٠٦٩، والنسائي في عمل اليوم والليلة ٩',
      grade: 'حسن', gradeKey: 'hasan',
      note: 'حسّنه جماعة من أهل العلم، وضعّفه الألباني لانقطاع في إسناده (مكحول عن أنس).'
    },
    {
      id: 9, sets: ['evening'], count: 4,
      ar: 'اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لاَ إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ.',
      tr: 'Allāhumma innī amsaytu ush-hiduk, wa-ush-hidu ḥamalata ʿarshik, wa-malāʾikatak, wa-jamīʿa khalqik, annaka anta-llāhu lā ilāha illā anta waḥdaka lā sharīka lak, wa-anna Muḥammadan ʿabduka wa-rasūluk.',
      en: 'O Allah, I have entered the evening calling You to witness, and calling to witness the bearers of Your Throne, Your angels and all Your creation, that You are Allah — there is no god but You alone, without partner — and that Muhammad is Your servant and Messenger.',
      ref: 'أبو داود ٥٠٦٩، والنسائي في عمل اليوم والليلة ٩',
      grade: 'حسن', gradeKey: 'hasan',
      note: 'حسّنه جماعة من أهل العلم، وضعّفه الألباني لانقطاع في إسناده (مكحول عن أنس).'
    },
    {
      id: 10, sets: ['morning'], count: 1,
      ar: 'اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ.',
      tr: 'Allāhumma mā aṣbaḥa bī min niʿmatin aw bi-aḥadin min khalqik, fa-minka waḥdaka lā sharīka lak, fa-laka-l-ḥamdu wa-laka-sh-shukr.',
      en: 'O Allah, whatever blessing I or any of Your creation have risen with this morning is from You alone, without partner. To You belongs all praise and to You belongs all thanks.',
      ref: 'أبو داود ٥٠٧٣، والنسائي في عمل اليوم والليلة ٧، وابن السني ٤١؛ حسّن إسناده عبد القادر الأرناؤوط في تخريج الأذكار',
      grade: 'مختلف فيه', gradeKey: 'disputed',
      note: 'حسّن إسناده الأرناؤوط، وضعّفه الألباني.',
      virtue: 'من قالها حين يصبح فقد أدّى شكر يومه.'
    },
    {
      id: 11, sets: ['evening'], count: 1,
      ar: 'اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ.',
      tr: 'Allāhumma mā amsā bī min niʿmatin aw bi-aḥadin min khalqik, fa-minka waḥdaka lā sharīka lak, fa-laka-l-ḥamdu wa-laka-sh-shukr.',
      en: 'O Allah, whatever blessing I or any of Your creation have entered this evening with is from You alone, without partner. To You belongs all praise and to You belongs all thanks.',
      ref: 'أبو داود ٥٠٧٣، والنسائي في عمل اليوم والليلة ٧، وابن السني ٤١؛ حسّن إسناده عبد القادر الأرناؤوط في تخريج الأذكار',
      grade: 'مختلف فيه', gradeKey: 'disputed',
      note: 'حسّن إسناده الأرناؤوط، وضعّفه الألباني.',
      virtue: 'من قالها حين يمسي فقد أدّى شكر ليلته.'
    },
    {
      id: 12, sets: ['morning', 'evening'], count: 3,
      ar: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَهَ إِلاَّ أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لاَ إِلَهَ إِلاَّ أَنْتَ.',
      tr: 'Allāhumma ʿāfinī fī badanī, Allāhumma ʿāfinī fī samʿī, Allāhumma ʿāfinī fī baṣarī, lā ilāha illā ant. Allāhumma innī aʿūdhu bika mina-l-kufri wa-l-faqr, wa-aʿūdhu bika min ʿadhābi-l-qabr, lā ilāha illā ant.',
      en: 'O Allah, grant my body well-being. O Allah, grant my hearing well-being. O Allah, grant my sight well-being. There is no god but You. O Allah, I seek refuge in You from disbelief and poverty, and I seek refuge in You from the punishment of the grave. There is no god but You.',
      ref: 'أبو داود ٥٠٩٠، وأحمد ٥/٤٢؛ حسنه الألباني في صحيح أبي داود ٣/٩٥٩',
      grade: 'حسن', gradeKey: 'hasan'
    },
    {
      id: 13, sets: ['morning', 'evening'], count: 7,
      ar: 'حَسْبِيَ اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.',
      tr: 'Ḥasbiya-llāhu lā ilāha illā huwa, ʿalayhi tawakkalt, wa-huwa rabbu-l-ʿarshi-l-ʿaẓīm.',
      en: 'Allah is sufficient for me; there is no god but He. In Him I place my trust, and He is the Lord of the Mighty Throne.',
      ref: 'ابن السني ٧١ مرفوعاً، وأبو داود ٥٠٨١ موقوفاً؛ صحّح إسناد الموقوف الأرناؤوط في تخريج زاد المعاد ٢/٣٧٦',
      grade: 'مختلف فيه', gradeKey: 'disputed',
      note: 'صحّح الأرناؤوط وابن باز إسناده موقوفاً على أبي الدرداء، وحكم الألباني على المرفوع بالوضع (ضعيف أبي داود، السلسلة الضعيفة ٥٢٨٦).',
      virtue: 'من قالها حين يصبح وحين يمسي سبع مرات كفاه الله ما أهمّه من أمر الدنيا والآخرة.'
    },
    {
      id: 14, sets: ['morning', 'evening'], count: 1,
      ar: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ. اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي. اللَّهُمَّ اسْتُرْ عَوْرَاتِي، وَآمِنْ رَوْعَاتِي. اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ، وَمِنْ خَلْفِي، وَعَنْ يَمِينِي، وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي.',
      tr: 'Allāhumma innī asʾaluka-l-ʿafwa wa-l-ʿāfiyata fi-d-dunyā wa-l-ākhirah. Allāhumma innī asʾaluka-l-ʿafwa wa-l-ʿāfiyata fī dīnī wa-dunyāya wa-ahlī wa-mālī. Allāhumma-stur ʿawrātī, wa-āmin rawʿātī. Allāhumma-ḥfaẓnī min bayni yadayya, wa-min khalfī, wa-ʿan yamīnī, wa-ʿan shimālī, wa-min fawqī, wa-aʿūdhu bi-ʿaẓamatika an ughtāla min taḥtī.',
      en: 'O Allah, I ask You for pardon and well-being in this world and the next. O Allah, I ask You for pardon and well-being in my religion, my worldly affairs, my family and my wealth. O Allah, conceal my faults and calm my fears. O Allah, guard me from before me and behind me, from my right and my left, and from above me; and I seek refuge in Your greatness from being taken unaware from beneath me.',
      ref: 'أبو داود ٥٠٧٤، وابن ماجه ٣٨٧١؛ صححه الألباني في صحيح ابن ماجه ٢/٣٣٢',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 15, sets: ['morning', 'evening'], count: 1,
      ar: 'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ، فَاطِرَ السَّمَوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءاً، أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ.',
      tr: 'Allāhumma ʿālima-l-ghaybi wa-sh-shahādah, fāṭira-s-samāwāti wa-l-arḍ, rabba kulli shayʾin wa-malīkah, ash-hadu an lā ilāha illā ant. Aʿūdhu bika min sharri nafsī, wa-min sharri-sh-shayṭāni wa-shirkih, wa-an aqtarifa ʿalā nafsī sūʾan, aw ajurrahu ilā muslim.',
      en: 'O Allah, Knower of the unseen and the seen, Originator of the heavens and the earth, Lord and Sovereign of all things — I bear witness that there is no god but You. I seek refuge in You from the evil of my own soul, and from the evil of Satan and his call to associate partners with You, and from bringing evil upon myself or dragging it onto any Muslim.',
      ref: 'الترمذي ٣٣٩٢، وأبو داود ٥٠٦٧؛ صححه الألباني في صحيح الترمذي ٣/١٤٢',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 16, sets: ['morning', 'evening'], count: 3,
      ar: 'بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلاَ فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ.',
      tr: 'Bismi-llāhi-lladhī lā yaḍurru maʿa-smihi shayʾun fi-l-arḍi wa-lā fi-s-samāʾ, wa-huwa-s-samīʿu-l-ʿalīm.',
      en: 'In the name of Allah, with whose name nothing on earth or in the heaven can cause harm; and He is the All-Hearing, the All-Knowing.',
      ref: 'أبو داود ٥٠٨٨، والترمذي ٣٣٨٨، وابن ماجه ٣٨٦٩؛ صححه الألباني في صحيح ابن ماجه ٢/٣٣٢',
      grade: 'صحيح', gradeKey: 'sahih',
      virtue: 'من قالها ثلاث مرات لم يضره شيء.'
    },
    {
      id: 17, sets: ['morning', 'evening'], count: 3,
      ar: 'رَضِيتُ بِاللَّهِ رَبّاً، وَبِالْإِسْلاَمِ دِيناً، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيّاً.',
      tr: 'Raḍītu billāhi rabban, wa-bi-l-islāmi dīnan, wa-bi-Muḥammadin ṣalla-llāhu ʿalayhi wa-sallama nabiyyan.',
      en: 'I am content with Allah as my Lord, with Islam as my religion, and with Muhammad (peace be upon him) as my Prophet.',
      ref: 'أحمد ٤/٣٣٧، والنسائي في عمل اليوم والليلة ٤ (وفيهما «ثلاث مرات»)، وأبو داود ٥٠٧٢، والترمذي ٣٣٨٩؛ حسنه الألباني في صحيح الترمذي ٣/١٤٠',
      grade: 'حسن', gradeKey: 'hasan',
      virtue: 'من قالها ثلاثاً حين يصبح وحين يمسي كان حقاً على الله أن يُرضيه يوم القيامة.'
    },
    {
      id: 18, sets: ['morning', 'evening'], count: 1,
      ar: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلاَ تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ.',
      tr: 'Yā Ḥayyu yā Qayyūm, bi-raḥmatika astaghīth, aṣliḥ lī shaʾnī kullah, wa-lā takilnī ilā nafsī ṭarfata ʿayn.',
      en: 'O Ever-Living, O Sustainer of all — by Your mercy I seek help. Set right all my affairs, and do not leave me to myself for even the blink of an eye.',
      ref: 'الحاكم ١/٥٤٥ وصححه ووافقه الذهبي؛ حسنه الألباني في صحيح الترغيب ١/٢٧٣',
      grade: 'حسن', gradeKey: 'hasan'
    },
    {
      id: 19, sets: ['morning'], count: 1,
      ar: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ. اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذَا الْيَوْمِ: فَتْحَهُ، وَنَصْرَهُ، وَنُورَهُ، وَبَرَكَتَهُ، وَهُدَاهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهِ وَشَرِّ مَا بَعْدَهُ.',
      tr: 'Aṣbaḥnā wa-aṣbaḥa-l-mulku lillāhi rabbi-l-ʿālamīn. Allāhumma innī asʾaluka khayra hādha-l-yawm: fatḥahu, wa-naṣrahu, wa-nūrahu, wa-barakatahu, wa-hudāh; wa-aʿūdhu bika min sharri mā fīhi wa-sharri mā baʿdah.',
      en: 'We have entered the morning and the dominion belongs to Allah, Lord of the worlds. O Allah, I ask You for the good of this day: its opening, its victory, its light, its blessing and its guidance; and I seek refuge in You from the evil within it and the evil that follows it.',
      ref: 'أبو داود ٥٠٨٤؛ حسّن إسناده الأرناؤوط في تخريج زاد المعاد ٢/٢٧٣',
      grade: 'حسن', gradeKey: 'hasan'
    },
    {
      id: 20, sets: ['evening'], count: 1,
      ar: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ. اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذِهِ اللَّيْلَةِ: فَتْحَهَا، وَنَصْرَهَا، وَنُورَهَا، وَبَرَكَتَهَا، وَهُدَاهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهَا وَشَرِّ مَا بَعْدَهَا.',
      tr: 'Amsaynā wa-amsa-l-mulku lillāhi rabbi-l-ʿālamīn. Allāhumma innī asʾaluka khayra hādhihi-l-laylah: fatḥahā, wa-naṣrahā, wa-nūrahā, wa-barakatahā, wa-hudāhā; wa-aʿūdhu bika min sharri mā fīhā wa-sharri mā baʿdahā.',
      en: 'We have entered the evening and the dominion belongs to Allah, Lord of the worlds. O Allah, I ask You for the good of this night: its opening, its victory, its light, its blessing and its guidance; and I seek refuge in You from the evil within it and the evil that follows it.',
      ref: 'أبو داود ٥٠٨٤؛ حسّن إسناده الأرناؤوط في تخريج زاد المعاد ٢/٢٧٣',
      grade: 'حسن', gradeKey: 'hasan'
    },
    {
      id: 21, sets: ['morning'], count: 1,
      ar: 'أَصْبَحْنَا عَلَى فِطْرَةِ الْإِسْلاَمِ، وَعَلَى كَلِمَةِ الْإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ الْمُشْرِكِينَ.',
      tr: 'Aṣbaḥnā ʿalā fiṭrati-l-islām, wa-ʿalā kalimati-l-ikhlāṣ, wa-ʿalā dīni nabiyyinā Muḥammadin ṣalla-llāhu ʿalayhi wa-sallam, wa-ʿalā millati abīnā Ibrāhīma ḥanīfan musliman wa-mā kāna mina-l-mushrikīn.',
      en: 'We have entered the morning upon the natural way of Islam, upon the word of sincere devotion, upon the religion of our Prophet Muhammad (peace be upon him), and upon the faith of our father Abraham — upright, submitting, and he was not of those who associate partners with Allah.',
      ref: 'أحمد ٣/٤٠٦–٤٠٧، وابن السني ٣٤؛ صححه الألباني في صحيح الجامع ٤٦٧٤',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 22, sets: ['evening'], count: 1,
      ar: 'أَمْسَيْنَا عَلَى فِطْرَةِ الْإِسْلاَمِ، وَعَلَى كَلِمَةِ الْإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ الْمُشْرِكِينَ.',
      tr: 'Amsaynā ʿalā fiṭrati-l-islām, wa-ʿalā kalimati-l-ikhlāṣ, wa-ʿalā dīni nabiyyinā Muḥammadin ṣalla-llāhu ʿalayhi wa-sallam, wa-ʿalā millati abīnā Ibrāhīma ḥanīfan musliman wa-mā kāna mina-l-mushrikīn.',
      en: 'We have entered the evening upon the natural way of Islam, upon the word of sincere devotion, upon the religion of our Prophet Muhammad (peace be upon him), and upon the faith of our father Abraham — upright, submitting, and he was not of those who associate partners with Allah.',
      ref: 'أحمد ٣/٤٠٦–٤٠٧، وابن السني ٣٤؛ صححه الألباني في صحيح الجامع ٤٦٧٤',
      grade: 'صحيح', gradeKey: 'sahih'
    },
    {
      id: 23, sets: ['morning', 'evening'], count: 100,
      ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.',
      tr: 'Subḥāna-llāhi wa-bi-ḥamdih.',
      en: 'Glory be to Allah, and praise be to Him.',
      ref: 'رواه مسلم ٢٦٩٢',
      grade: 'صحيح', gradeKey: 'sahih',
      virtue: 'من قالها مائة مرة حين يصبح وحين يمسي لم يأتِ أحد يوم القيامة بأفضل مما جاء به، إلا أحد قال مثل ما قال أو زاد عليه.'
    },
    {
      id: 24, sets: ['morning'], count: 100,
      ar: 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.',
      tr: 'Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa-lahu-l-ḥamd, wa-huwa ʿalā kulli shayʾin qadīr.',
      en: 'There is no god but Allah alone, without partner. His is the dominion and His is the praise, and He has power over everything.',
      ref: 'متفق عليه · البخاري ٣٢٩٣، ومسلم ٢٦٩١',
      grade: 'متفق عليه', gradeKey: 'agreed',
      virtue: 'من قالها مائة مرة في يوم كانت له عدل عشر رقاب، وكُتبت له مائة حسنة، ومُحيت عنه مائة سيئة، وكانت له حرزاً من الشيطان يومه ذلك حتى يمسي.'
    },
    {
      id: 25, sets: ['morning', 'evening'], count: 10,
      ar: 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.',
      tr: 'Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa-lahu-l-ḥamd, wa-huwa ʿalā kulli shayʾin qadīr.',
      en: 'There is no god but Allah alone, without partner. His is the dominion and His is the praise, and He has power over everything.',
      ref: 'النسائي في عمل اليوم والليلة ٢٤، وابن السني ١٢٧؛ حسّنه ابن حجر في نتائج الأفكار ٢/٣٨٥',
      grade: 'حسن', gradeKey: 'hasan',
      note: 'أو مرّةً واحدةً عند الكسل.',
      virtue: 'كتب الله له مائة حسنة، ومحا عنه مائة سيئة، وكانت له عدل عشر رقاب.'
    },
    {
      id: 26, sets: ['morning'], count: 3,
      ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ: عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ.',
      tr: 'Subḥāna-llāhi wa-bi-ḥamdih: ʿadada khalqih, wa-riḍā nafsih, wa-zinata ʿarshih, wa-midāda kalimātih.',
      en: 'Glory be to Allah and praise be to Him — as many times as the number of His creation, as fits His own pleasure, as much as the weight of His Throne, and as endless as the ink of His words.',
      ref: 'رواه مسلم ٢٧٢٦',
      grade: 'صحيح', gradeKey: 'sahih',
      virtue: 'تعدل في الأجر ما قيل من الذكر منذ الصباح إلى الضحى.'
    },
    {
      id: 27, sets: ['morning'], count: 1,
      ar: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْماً نَافِعاً، وَرِزْقاً طَيِّباً، وَعَمَلاً مُتَقَبَّلاً.',
      tr: 'Allāhumma innī asʾaluka ʿilman nāfiʿan, wa-rizqan ṭayyiban, wa-ʿamalan mutaqabbalan.',
      en: 'O Allah, I ask You for beneficial knowledge, wholesome provision, and deeds that are accepted.',
      ref: 'ابن ماجه ٩٢٥، وأحمد ٦/٢٩٤؛ صححه الألباني في صحيح ابن ماجه ١/١٥٢',
      grade: 'صحيح', gradeKey: 'sahih',
      note: 'تُقال بعد السلام من صلاة الفجر.'
    },
    {
      id: 28, sets: ['morning', 'evening'], count: 100,
      ar: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ.',
      tr: 'Astaghfiru-llāha wa-atūbu ilayh.',
      en: 'I seek Allah’s forgiveness and I turn to Him in repentance.',
      ref: 'مسلم ٢٧٠٢ (مائة مرة)، والبخاري ٦٣٠٧ (أكثر من سبعين مرة)',
      grade: 'صحيح', gradeKey: 'sahih',
      note: 'لفظ المائة عند مسلم بصيغة «أستغفر الله»، وزيادة «وأتوب إليه» جاءت في روايات أخرى.',
      virtue: 'قال ﷺ: «إنه لَيُغانُ على قلبي، وإني لأستغفر الله في اليوم مائة مرة».'
    },
    {
      id: 29, sets: ['evening'], count: 3,
      ar: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.',
      tr: 'Aʿūdhu bi-kalimāti-llāhi-t-tāmmāti min sharri mā khalaq.',
      en: 'I seek refuge in the perfect words of Allah from the evil of what He has created.',
      ref: 'النسائي في عمل اليوم والليلة ٥٩٠، وابن السني ٦٨، وأحمد ٢/٢٩٠؛ صححه الألباني في صحيح الترمذي ٣/١٨٧، وأصله في مسلم ٢٧٠٩',
      grade: 'صحيح', gradeKey: 'sahih',
      virtue: 'من قالها حين يمسي ثلاث مرات لم تضرّه حُمَةٌ (لدغة سامّة) تلك الليلة.'
    },
    {
      id: 30, sets: ['morning', 'evening'], count: 10,
      ar: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ.',
      tr: 'Allāhumma ṣalli wa-sallim ʿalā nabiyyinā Muḥammad.',
      en: 'O Allah, send blessings and peace upon our Prophet Muhammad.',
      ref: 'الطبراني في المعجم الأوسط ١/٤٧؛ حسّنه المنذري، ورجع الألباني إلى تضعيفه (السلسلة الضعيفة ٥٧٨٨)',
      grade: 'مختلف فيه', gradeKey: 'disputed',
      note: 'إسناد حديث «العشر» منقطع عند العراقي والسخاوي والألباني؛ وفضل الصلاة على النبي ﷺ ثابت بأدلة أخرى في كل حال.',
      virtue: 'قال ﷺ: «من صلّى عليّ حين يصبح عشراً وحين يمسي عشراً أدركته شفاعتي يوم القيامة».'
    }
  ]
};
