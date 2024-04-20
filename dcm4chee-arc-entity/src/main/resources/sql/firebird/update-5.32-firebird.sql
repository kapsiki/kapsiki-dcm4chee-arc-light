-- can be applied on archive running archive 5.31
update instance set ext_retrieve_aet = '*' where ext_retrieve_aet is null;
update series set ext_retrieve_aet = '*' where ext_retrieve_aet is null;
alter table study add study_deleting smallint;
update study set study_deleting = false;

-- part 2: shall be applied on stopped archive before starting 5.32
update instance set ext_retrieve_aet = '*' where ext_retrieve_aet is null;
update series set ext_retrieve_aet = '*' where ext_retrieve_aet is null;
update study set study_deleting = false where study_deleting is null;

-- part 3: can be applied on already running archive 5.32
alter table instance alter column ext_retrieve_aet set not null;
alter table series alter column ext_retrieve_aet set not null;
alter table study alter column study_deleting set not null;
