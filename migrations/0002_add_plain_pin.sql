-- 教師が管理画面でPINを確認できるよう平文を保持する(4桁PINはハッシュ化しても総当たりで即座に復元できるため実質的な保護にならない)
ALTER TABLE students ADD COLUMN pin TEXT;
