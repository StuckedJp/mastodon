# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Paperclip::LazyThumbnail do
  subject(:output) { Vips::Image.new_from_file(result.path) }

  let(:file) { Tempfile.new(['thumbnail', '.jpg']) }
  let(:attachment) { instance_double(Paperclip::Attachment, instance_read: 'image.jpg', instance: MediaAttachment.new) }
  let(:options) { { pixels: 2048, file_geometry_parser: FastGeometryParser } }
  let(:processed_files) { [] }
  let(:result) { described_class.new(file, options, attachment).make.tap { |tempfile| processed_files << tempfile } }

  after do
    processed_files.each(&:close!)
    file.close!
  end

  context 'with an SDR JPEG' do
    before do
      Vips::Image.black(128, 64, bands: 3).mutate do |image|
        image.set_type!(Vips::BLOB_TYPE, 'xmp-data', '<x:xmpmeta xmlns:x="adobe:ns:meta/">Private author</x:xmpmeta>')
      end.write_to_file(file.path)
    end

    it 'resizes the image and still strips private metadata' do
      expect(Vips::Image.new_from_file(file.path).get_fields).to include('xmp-data')
      expect([output.width, output.height]).to eq([64, 32])
      expect(output.get_fields).to_not include('xmp-data', 'gainmap-data')
    end
  end

  context 'with an Ultra HDR JPEG' do
    before do
      skip 'libvips was built without Ultra HDR support' if Vips.type_find('VipsOperation', 'uhdrsave').zero?

      Vips::Image.black(128, 64, bands: 3)
        .cast(:float)
        .new_from_image([4, 2, 1])
        .copy(interpretation: :scrgb)
        .write_to_file(file.path)
    end

    it 'preserves the resized gainmap and HDR rendering parameters in JPEG output' do
      input = Vips::Image.new_from_file(file.path)
      gainmap = Vips::Image.new_from_buffer(output.get('gainmap-data'), '')

      expect([output.width, output.height]).to eq([64, 32])
      expect([gainmap.width, gainmap.height]).to eq([32, 16])
      expect(output.get('vips-loader')).to eq('uhdrload')
      expect(output.get('gainmap-max-content-boost')).to eq(input.get('gainmap-max-content-boost'))
      expect(output.get('gainmap-gamma')).to eq(input.get('gainmap-gamma'))
      expect(output.uhdr2scRGB.max).to be > 1
    end

    context 'when the image is below the pixel limit' do
      let(:options) { { pixels: 32_768, file_geometry_parser: FastGeometryParser } }

      it 'preserves HDR while rewriting the local image without resizing' do
        expect([output.width, output.height]).to eq([128, 64])
        expect(output.get('vips-loader')).to eq('uhdrload')
        expect(output.uhdr2scRGB.max).to be > 1
      end
    end

    context 'without target dimensions' do
      let(:options) { { file_geometry_parser: FastGeometryParser } }

      it 'preserves HDR through the direct image loading path' do
        expect([output.width, output.height]).to eq([128, 64])
        expect(output.get('vips-loader')).to eq('uhdrload')
        expect(output.uhdr2scRGB.max).to be > 1
      end
    end
  end
end
