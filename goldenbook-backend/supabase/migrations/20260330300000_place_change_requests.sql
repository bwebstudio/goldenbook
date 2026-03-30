-- Place change requests: stores business edits pending editorial approval.
-- Live content is NOT overwritten until approved.

CREATE TABLE place_change_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id     uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  field_name   text NOT NULL,
  old_value    text,
  new_value    text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by   uuid,           -- business client user_id
  reviewed_by  text,           -- admin email
  review_note  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz
);

CREATE INDEX idx_change_requests_place ON place_change_requests (place_id);
CREATE INDEX idx_change_requests_status ON place_change_requests (status) WHERE status = 'pending';
