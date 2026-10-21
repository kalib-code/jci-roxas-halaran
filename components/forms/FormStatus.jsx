export default function FormStatus({ result }) {
  if (!result || result.ok) return null;
  return (
    <div className="form-errors" role="alert">
      <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}
